/**
 * Renders every transactional email by calling the REAL sender functions with
 * sample data, intercepting sgMail.send instead of delivering. That exercises
 * the actual code path — shell, sanitizer, detail rows, CC, subject — rather
 * than a parallel copy that could drift.
 *
 *   npx tsx scripts/preview-all-emails.mjs
 */
import "dotenv/config";
import fs from "fs"; import path from "path";
import sgMail from "@sendgrid/mail";

const captured = [];
sgMail.send = async (msg) => { captured.push(msg); return [{ headers: {} }, {}]; };

const E = await import("../server/email.ts");
const OUT = path.resolve("email-previews/transactional");
fs.mkdirSync(OUT, { recursive: true });

const J = "https://app.artswrk.com/jobs/hip-hop-sub-teacher-2460";
const BBCODE = "[color=rgb(94, 94, 94)]Seeking an energetic hip hop teacher for our competitive team. Ages 8-18, Tuesdays 4:30-6pm.[/color]";

await E.sendJobPostedEmail({ to: "c@x.com", firstName: "Dana", serviceType: "Substitute Teacher",
  date: "Thu, Sep 4 · 4:30–6:00 pm", location: "Brooklyn, NY", rate: "$60/hr",
  description: BBCODE, jobLink: J, transportation: true, transportDetails: "Subway fare reimbursed" });

await E.sendNewApplicantAlertEmail({ to: "c@x.com", artistFirstName: "Marisa", artistLastInitial: "L",
  jobTitle: "Hip Hop Sub Teacher", jobLocation: "Brooklyn, NY", jobRate: "$60/hr", jobUrl: J,
  message: "I teach hip hop at Broadway Dance Center and I'm free Tuesdays!" });

await E.sendNewMessageEmail({ to: "a@x.com", recipientFirstName: "Marisa", senderName: "Street Beatz",
  messagePreview: "Hi! Are you available for a sub on the 12th?", dashboardUrl: "https://app.artswrk.com/app/messages" });

await E.sendProJobApplicantAlertEmail({ to: "c@x.com", artistFirstName: "Adam", artistLastInitial: "W",
  message: "Former Rockette, 8 years teaching.", serviceType: "Judge", location: "Boston, MA",
  description: BBCODE, jobLink: J });

await E.sendArtistBookingConfirmedEmail({ to: "a@x.com", artistName: "Marisa", clientName: "Street Beatz",
  date: "Thu, Sep 4 · 4:30–6:00 pm", location: "Brooklyn, NY", rate: "$60/hr", serviceType: "Substitute Teacher",
  details: BBCODE, transportReimbursed: "yes", transportDetails: "Subway fare reimbursed",
  bookingUrl: "https://app.artswrk.com/app/bookings/12" });

await E.sendClientBookingConfirmedEmail({ to: "c@x.com", artistName: "Marisa Lopez", clientName: "Dana",
  date: "Thu, Sep 4 · 4:30–6:00 pm", location: "Brooklyn, NY", rate: "$60/hr", serviceType: "Substitute Teacher",
  details: "", bookingUrl: "https://app.artswrk.com/app/bookings/12" });

await E.sendClientPayArtistEmail({ to: "c@x.com", clientName: "Dana", artistName: "Marisa Lopez",
  clientRate: "$60/hr × 2 hrs", date: "Thu, Sep 4", reimbursements: "$12.50",
  totalClientRate: "132.50", payUrl: "https://app.artswrk.com/invoice/abc123" });

await E.sendProWelcomeEmail({ to: "a@x.com", firstName: "Marisa" });
await E.sendPayoutOnTheWayEmail({ to: "a@x.com", firstName: "Marisa", clientName: "Street Beatz",
  date: "Sep 4, 2026", location: "Brooklyn, NY", amount: "114.00" });
await E.sendClientPaymentReceiptEmail({ to: "c@x.com", firstName: "Dana", artistName: "Marisa Lopez",
  date: "Sep 4, 2026", rate: "$60/hr × 2 hrs", reimbursements: "$12.50", total: "132.50" });
await E.sendPaymentReminderEmail({ to: "c@x.com", firstName: "Dana", artistName: "Marisa Lopez",
  date: "Sep 4, 2026", total: "132.50", payUrl: "https://app.artswrk.com/invoice/abc123" });
await E.sendApplicationConfirmationEmail({ to: "a@x.com", artistName: "Rami",
  jobTitle: "Ballet Substitute Teacher", jobLocation: "New York, NY, USA",
  jobRate: "Open rate", jobUrl: "https://app.artswrk.com/jobs/ballet-substitute-teacher-2490001",
  jobDescription: "I'm hiring a ballet teacher for a sub on Monday! Intermediate teens, 4:30-6pm.",
  pitchedRate: "$75/hr",
  artistMessage: "I teach ballet at Broadway Dance Center and I'm free Monday afternoon — happy to cover this." });
await E.sendArtistWelcomeEmail({ to: "a@x.com", firstName: "Rami" });
await E.sendPasswordResetEmail({ to: "a@x.com", firstName: "Rami",
  resetUrl: "https://app.artswrk.com/reset-password?token=abc123" });
await E.sendProJobPostedEmail({ to: "c@x.com", firstName: "Dana", company: "REVEL Dance Convention",
  serviceType: "Emcee (Touring)", location: null, description: "Touring emcee for the 2027 season.",
  workFromAnywhere: true, jobLink: "https://app.artswrk.com/pro/emcee-touring-1050240" });
await E.sendProJobSubmissionConfirmationEmail({ to: "a@x.com", artistFirstName: "Rami",
  serviceType: "Emcee (Touring)", location: "Work from anywhere",
  description: "Touring emcee for the 2027 season.", dashboardLink: "https://app.artswrk.com/app",
  pitchedRate: "$850/day", resumeLink: "https://app.artswrk.com/r/abc",
  artistMessage: "I've emceed 40+ conventions and I'm available for the full spring tour." });

await E.sendInternalSubscriptionAlert({ userName: "Marisa Lopez", userEmail: "m@x.com",
  plan: "Artswrk PRO ($110/yr)", role: "Artist" });

const names = ["C1-job-posted","C3-applicant-alert","A5-new-message","C4-pro-applicant-alert",
               "A6-booking-confirmed-artist","C5-booking-confirmed-client","C6-pay-artist",
               "A2-pro-welcome","A11-payout","C9-client-receipt","C7-payment-reminder","A3-application-confirmation","A1-welcome","S1-password-reset","C2-pro-job-posted","A4-pro-submission",
               "I3-subscription-alert"];
captured.forEach((m, i) => {
  fs.writeFileSync(path.join(OUT, names[i] + ".html"), m.html ?? "");
  const problems = [];
  if (/\[\/?color/i.test(m.html ?? "")) problems.push("BBCODE LEAKED");
  if (/\(\s*\)/.test(m.html ?? "")) problems.push("empty () row");
  if (/localhost|manus\.space/.test(m.html ?? "")) problems.push("BAD HOST");
  if (/\*[A-Za-z]+:\*/.test(m.html ?? "")) problems.push("literal asterisks");
  if (!/asm_group_unsubscribe_raw_url/.test(m.html ?? "")) problems.push("no unsubscribe tag");
  console.log(`  ${names[i].padEnd(30)} cc=${(m.cc ?? "—").toString().padEnd(22)} ${problems.length ? "⚠ " + problems.join(", ") : "✓ clean"}`);
  console.log(`     ${m.subject}`);
});
console.log(`\n${captured.length} emails rendered to ${OUT}`);
process.exit(0);
