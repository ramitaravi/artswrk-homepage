/**
 * Shows the REAL to/cc/replyTo on the inquiry emails.
 *
 * EMAIL_REDIRECT_TO is cleared before importing server/email.ts so the dev
 * reroute wrapper (which rewrites `to` and wipes `cc`) never installs and hides
 * what would actually be sent. Nothing leaves the machine: sgMail.send is
 * replaced with a capture function first, so there is no transport at all.
 */
import "dotenv/config";
delete process.env.EMAIL_REDIRECT_TO;
process.env.SENDGRID_API_KEY = "stubbed-no-transport";

import sgMail from "@sendgrid/mail";
const sent = [];
sgMail.send = async (msg) => { sent.push(msg); return [{ headers: {} }, {}]; };

const E = await import("../server/email.ts");
await E.sendInquiryIntroEmail({
  email: "qa-synthetic@example.com", company: "QA Competition", source: "judge-experience",
  message: "Hi there, I'm interested in learning more about The Judge Experience...",
});
await E.sendInquiryIntroEmail({
  email: "qa-synthetic@example.com", company: "QA Competition", source: "dance-competitions",
  message: "Need 3 judges for our Orlando regional.",
});

const labels = ["Judge Experience intro", "Competition inquiry intro"];
sent.forEach((m, i) => {
  console.log(`\n${labels[i]}`);
  console.log("  to:      ", m.to);
  console.log("  cc:      ", m.cc ?? "(none)");
  console.log("  replyTo: ", m.replyTo ?? "(none)");
  console.log("  subject: ", m.subject);
});
// One email per inquiry now, so the two above are different threads by design.
// What matters is that each puts both parties on the same message.
const ok = sent.every((m) => m.cc === "contact@artswrk.com" && m.replyTo === "contact@artswrk.com");
console.log("\nboth parties on every thread (to=enquirer, cc=contact@):", ok ? "YES ✓" : "NO ✗");
console.log("no separate receipt sent:", sent.length === 2 ? "YES ✓ (1 per inquiry)" : "NO ✗");
process.exit(0);
