import "dotenv/config";
import sgMail from "@sendgrid/mail";
import fs from "fs";

const captured = [];
sgMail.send = async (msg) => { captured.push(msg); return [{ headers: {} }, {}]; };

const E = await import("../server/email.ts");
await E.sendEnterpriseInquiryAlertEmail({
  email: "taylor@dancerevel.com", name: "Taylor", company: "REVEL Dance Convention",
  phone: "555-0100", source: "dance-competitions",
  message: "We need judges and emcees for 12 city stops Feb–May 2027.",
});
await E.sendEnterpriseInquiryConfirmationEmail({
  to: "taylor@dancerevel.com", name: "Taylor", company: "REVEL Dance Convention",
});

captured.forEach((m, i) => {
  console.log(`--- email ${i + 1} ---`);
  console.log("  to:     ", m.to);
  console.log("  cc:     ", m.cc ?? "(none)");
  console.log("  subject:", m.subject);
  console.log("  replyTo:", m.replyTo ?? "(none)");
  fs.writeFileSync(`/tmp/inquiry-${i + 1}.html`, m.html);
});
console.log("\nprevews written to /tmp/inquiry-1.html and /tmp/inquiry-2.html");
process.exit(0);
