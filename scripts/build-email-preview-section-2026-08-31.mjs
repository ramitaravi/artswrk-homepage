/**
 * Reads the rendered booking-flow email HTML files and prints a JS object
 * literal (JSON) mapping preview-id -> full HTML string, safe to inline into
 * a <script> tag (JSON.stringify handles all escaping). Paste the output
 * into the artifact's EMAIL_HTML script block.
 */
import fs from "fs";
import path from "path";

const DIR = path.resolve("email-previews/booking-flow");
const files = {
  "artist-booking-confirmed": "artist-booking-confirmed.html",
  "client-booking-confirmed": "client-booking-confirmed.html",
  "complete-booking-reminder-artswrk": "complete-booking-reminder-artswrk.html",
  "complete-booking-reminder-direct": "complete-booking-reminder-direct.html",
  "client-pay-artist-request": "client-pay-artist-request.html",
  "artist-payment-received": "artist-payment-received.html",
  "client-payment-receipt": "client-payment-receipt.html",
};

const out = {};
for (const [key, filename] of Object.entries(files)) {
  out[key] = fs.readFileSync(path.join(DIR, filename), "utf-8");
}

fs.writeFileSync(path.resolve("email-previews/booking-flow/_bundle.json"), JSON.stringify(out));
console.log("wrote email-previews/booking-flow/_bundle.json,", JSON.stringify(out).length, "bytes");
