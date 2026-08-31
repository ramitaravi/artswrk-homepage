/**
 * Reads the rendered booking-flow email HTML files and prints a JS object
 * literal (JSON) mapping preview-id -> full HTML string, safe to inline into
 * a <script> tag (JSON.stringify handles all escaping). Paste the output
 * into the artifact's EMAIL_HTML script block.
 *
 * Logo URLs get swapped for embedded data: URIs here — the artifact viewer's
 * CSP blocks remote images entirely, so the real https://app.artswrk.com/
 * logo URLs (confirmed live, 200, real PNGs) would just show as broken
 * images inside the preview iframes. Real email clients have no such
 * restriction, so the actual sender functions / production emails are
 * untouched — this swap only happens in this preview copy.
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

const LOGO_URLS = [
  "https://app.artswrk.com/logos/artswrk-pink.png",
  "https://app.artswrk.com/logos/artswrk-orange.png",
];
const LOGO_DATA_URIS = {};
for (const url of LOGO_URLS) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Logo fetch failed: ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  LOGO_DATA_URIS[url] = `data:image/png;base64,${buf.toString("base64")}`;
}

const out = {};
for (const [key, filename] of Object.entries(files)) {
  let html = fs.readFileSync(path.join(DIR, filename), "utf-8");
  for (const [remoteUrl, dataUri] of Object.entries(LOGO_DATA_URIS)) {
    html = html.split(remoteUrl).join(dataUri);
  }
  out[key] = html;
}

fs.writeFileSync(path.resolve("email-previews/booking-flow/_bundle.json"), JSON.stringify(out));
console.log("wrote email-previews/booking-flow/_bundle.json,", JSON.stringify(out).length, "bytes");
