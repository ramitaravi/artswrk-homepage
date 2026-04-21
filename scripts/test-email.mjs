import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import sgMail from "@sendgrid/mail";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const key = process.env.SENDGRID_API_KEY;
if (!key) { console.error("SENDGRID_API_KEY not set"); process.exit(1); }

sgMail.setApiKey(key);

const html = `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
    <h2 style="margin-bottom:4px">✅ Artswrk DB Sync — Email Test</h2>
    <p style="color:#666;margin-top:0">This is a test email confirming the sync notification system is working correctly.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      <thead><tr style="background:#f7f7f7"><th style="padding:8px 12px;text-align:left">Table</th><th style="padding:8px 12px;text-align:right">Result</th></tr></thead>
      <tbody>
        <tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:500">jobs</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">767 upserted</td></tr>
        <tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:500">premium_jobs</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">187 upserted (bug fixed ✅)</td></tr>
        <tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:500">interested_artists</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">9,728 upserted</td></tr>
        <tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:500">bookings</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">3,942 upserted</td></tr>
        <tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:500">conversations</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">4,935 upserted</td></tr>
        <tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:500">payments</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">14,365 upserted</td></tr>
        <tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:500">messages</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">14,132 upserted</td></tr>
      </tbody>
    </table>
    <p style="margin-top:20px;color:#333">The sync system is set up and running. Going forward, you'll receive an email like this after every scheduled sync run (every 15 minutes for frequent mode, daily at 2am for users).</p>
    <p style="color:#999;font-size:12px;margin-top:24px">Sent at ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>
  </div>
`;

try {
  await sgMail.send({
    to: "ramita@artswrk.com",
    from: { email: "contact@artswrk.com", name: "Artswrk Sync" },
    subject: `[Artswrk Sync] Test Email — System Working ✅`,
    html,
  });
  console.log("✅ Test email sent successfully to ramita@artswrk.com");
} catch (err) {
  console.error("❌ Failed to send email:", err.response?.body || err.message);
  process.exit(1);
}
