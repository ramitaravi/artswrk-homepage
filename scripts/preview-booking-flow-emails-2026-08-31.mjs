/**
 * Renders every email in the booking flow by calling the REAL sender
 * functions with sample data, intercepting sgMail.send instead of
 * delivering — same technique as scripts/preview-all-emails.mjs, scoped to
 * just the booking-flow set for the audit artifact.
 *
 *   npx tsx scripts/preview-booking-flow-emails-2026-08-31.mjs
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import sgMail from "@sendgrid/mail";

const captured = [];
sgMail.send = async (msg) => { captured.push(msg); return [{ headers: {} }, {}]; };

const E = await import("../server/email.ts");
const OUT = path.resolve("email-previews/booking-flow");
fs.mkdirSync(OUT, { recursive: true });

const bookingUrl = "https://app.artswrk.com/app/bookings";

await E.sendArtistBookingConfirmedEmail({
  to: "a@x.com", artistName: "Marisa", clientName: "Street Beatz",
  date: "Thu, Sep 4 · 4:30–6:00 pm", location: "Brooklyn, NY", rate: "$60/hr",
  serviceType: "Substitute Teacher", details: "Hip hop sub, ages 8-18.",
  bookingUrl: `${bookingUrl}`, paymentMethod: "artswrk",
});

await E.sendClientBookingConfirmedEmail({
  to: "c@x.com", artistName: "Marisa Lopez", clientName: "Dana",
  date: "Thu, Sep 4 · 4:30–6:00 pm", location: "Brooklyn, NY", rate: "$60/hr",
  serviceType: "Substitute Teacher", details: "Hip hop sub, ages 8-18.",
  bookingUrl: `${bookingUrl}`, paymentMethod: "direct",
});

await E.sendCompleteBookingReminderEmail({
  to: "a@x.com", firstName: "Marisa", bookingUrl,
});

await E.sendConfirmDirectPaymentReminderEmail({
  to: "a@x.com", firstName: "Marisa", bookingUrl,
});

await E.sendClientPayArtistEmail({
  to: "c@x.com", clientName: "Dana", artistName: "Marisa Lopez",
  clientRate: "$60/hr × 2 hrs", date: "Thu, Sep 4", reimbursements: "$12.50",
  totalClientRate: "132.50", payUrl: "https://app.artswrk.com/invoice/abc123",
});

await E.sendArtistPaymentReceivedEmail({
  to: "a@x.com", firstName: "Marisa", bookingLabel: "Booking #2460", amount: "114.00",
});

await E.sendClientPaymentReceiptEmail({
  to: "c@x.com", firstName: "Dana", artistName: "Marisa Lopez",
  date: "Booking #2460", total: "132.50",
});

const names = [
  "artist-booking-confirmed", "client-booking-confirmed",
  "complete-booking-reminder-artswrk", "complete-booking-reminder-direct",
  "client-pay-artist-request", "artist-payment-received", "client-payment-receipt",
];
captured.forEach((m, i) => {
  fs.writeFileSync(path.join(OUT, names[i] + ".html"), m.html ?? "");
  console.log(`${names[i].padEnd(38)} ${m.subject}`);
});
console.log(`\n${captured.length} emails rendered to ${OUT}`);
process.exit(0);
