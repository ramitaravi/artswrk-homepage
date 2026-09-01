import "dotenv/config";
import sgMail from "@sendgrid/mail";
const captured = [];
sgMail.send = async (msg) => { captured.push(msg); return [{ headers: {} }, {}]; };
const E = await import("../server/email.ts");

const calls = [
  ["ArtistWelcome", () => E.sendArtistWelcomeEmail({ to: "a@x.com", firstName: "A" })],
  ["PasswordReset", () => E.sendPasswordResetEmail({ to: "a@x.com", firstName: "A", resetUrl: "https://artswrk.com/reset?t=1" })],
  ["ApplicationConfirm", () => E.sendApplicationConfirmationEmail({ to: "a@x.com", artistName: "A", jobTitle: "J", jobUrl: "https://artswrk.com/jobs/1" })],
  ["NewApplicantAlert", () => E.sendNewApplicantAlertEmail({ to: "c@x.com", artistFirstName: "A", jobTitle: "J", jobUrl: "https://artswrk.com/jobs/1" })],
  ["JobPosted", () => E.sendJobPostedEmail({ to: "c@x.com", firstName: "C", serviceType: "S", date: "d", location: "l", rate: "r", description: "x", jobLink: "https://artswrk.com/jobs/1", transportation: false })],
  ["ProJobPosted", () => E.sendProJobPostedEmail({ to: "c@x.com", firstName: "C", company: "Co", serviceType: "S", location: null, description: null, workFromAnywhere: false, jobLink: "https://artswrk.com/jobs/1" })],
  ["ProJobApplicantAlert", () => E.sendProJobApplicantAlertEmail({ to: "c@x.com", artistFirstName: "A", artistLastInitial: "B", jobTitle: "J", jobUrl: "https://artswrk.com/x" })],
  ["ProJobSubmissionConfirm", () => E.sendProJobSubmissionConfirmationEmail({ to: "a@x.com", artistFirstName: "A", serviceType: "S" })],
  ["ArtistBookingConfirmed", () => E.sendArtistBookingConfirmedEmail({ to: "a@x.com", artistName: "A", clientName: "C", serviceType: "S" })],
  ["ClientBookingConfirmed", () => E.sendClientBookingConfirmedEmail({ to: "c@x.com", artistName: "A" })],
  ["ClientPayArtist", () => E.sendClientPayArtistEmail({ to: "c@x.com", artistName: "A", clientRate: "100" })],
  ["ProWelcome", () => E.sendProWelcomeEmail({ to: "a@x.com", firstName: "A" })],
  ["PayoutOnTheWay", () => E.sendPayoutOnTheWayEmail({ to: "a@x.com", firstName: "A", clientName: "C", date: "d", amount: "10" })],
  ["ArtistPaymentReceived", () => E.sendArtistPaymentReceivedEmail({ to: "a@x.com", firstName: "A", bookingLabel: "B", amount: "10" })],
  ["ClientPaymentReceipt", () => E.sendClientPaymentReceiptEmail({ to: "c@x.com", firstName: "C", artistName: "A", date: "d", rate: "1", reimbursements: "0", total: "1" })],
  ["PaymentReminder", () => E.sendPaymentReminderEmail({ to: "c@x.com", firstName: "C", artistName: "A", date: "d" })],
  ["CompleteBookingReminder", () => E.sendCompleteBookingReminderEmail({ to: "a@x.com", firstName: "A", bookingUrl: "https://artswrk.com/app/bookings/1" })],
  ["ConfirmDirectPayment", () => E.sendConfirmDirectPaymentReminderEmail({ to: "a@x.com", firstName: "A", bookingUrl: "https://artswrk.com/app/bookings/1" })],
  ["NewMessage", () => E.sendNewMessageEmail({ to: "a@x.com", recipientFirstName: "A", senderName: "S", messagePreview: "hi", dashboardUrl: "" })],
  ["FirstLoginAlert", () => E.sendFirstLoginAlertEmail({ name: "A", email: "a@x.com", userId: 1 })],
  ["StripeConnectAlert", () => E.sendStripeConnectAlertEmail({ artistName: "A", accountId: "acct_1" })],
  ["InquiryIntro (judge)", () => E.sendInquiryIntroEmail({ email: "a@x.com", source: "judge-experience" })],
  ["InquiryIntro (comp)", () => E.sendInquiryIntroEmail({ email: "a@x.com", company: "Comp", source: "dance-competitions" })],
];

let bad = 0;
for (const [name, fn] of calls) {
  captured.length = 0;
  try { await fn(); } catch (e) { console.log(`  ${name}: THREW ${String(e).slice(0,60)}`); continue; }
  const html = captured[0]?.html ?? "";
  const oldLinks = [...html.matchAll(/https?:\/\/[^"'\s>]*app\.artswrk\.com[^"'\s>]*/g)].map(m => m[0]);
  const localhost = [...html.matchAll(/https?:\/\/localhost[^"'\s>]*/g)].map(m => m[0]);
  const manus = [...html.matchAll(/https?:\/\/[^"'\s>]*manus[^"'\s>]*/g)].map(m => m[0]);
  const issues = [...oldLinks, ...localhost, ...manus];
  if (issues.length) { bad++; console.log(`  ✗ ${name}: ${[...new Set(issues)].slice(0,3).join(", ")}`); }
  else console.log(`  ✓ ${name}`);
}
console.log(bad === 0 ? "\nALL EMAILS POINT AT THE LIVE SITE ✓" : `\n${bad} email(s) still reference an old/dev host`);
process.exit(0);
