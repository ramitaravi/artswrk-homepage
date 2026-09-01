import "dotenv/config";
import sgMail from "@sendgrid/mail";
import fs from "fs";

let captured;
sgMail.send = async (msg) => { captured = msg; return [{ headers: {} }, {}]; };

const E = await import("../server/email.ts");
await E.sendFirstLoginAlertEmail({ name: "Marisa Lopez", email: "marisa@example.com", userRole: "Artist", userId: 780197 });
console.log("Subject:", captured.subject);
console.log("To:", captured.to);
fs.writeFileSync("/tmp/first-login-alert-preview.html", captured.html);
console.log("saved preview to /tmp/first-login-alert-preview.html");
process.exit(0);
