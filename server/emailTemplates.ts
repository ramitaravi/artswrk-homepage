/**
 * ARTSWRK EMAIL SHELL
 * ─────────────────────────────────────────────────────────────────────────────
 * One layout, three accents, used by every transactional email the site sends.
 * Replaces the SendGrid dynamic templates: the markup lives here so it shows up
 * in a diff, can be rendered without sending anything, and can't silently
 * change under us in a vendor UI.
 *
 * SendGrid is still the transport — every send goes through sgMail.send() in
 * server/email.ts, which is also what keeps the EMAIL_REDIRECT_TO dev safety
 * net working. Only the template layer is retired, never the pipe.
 *
 * Accents (brief §1):
 *   artist   — hot pink gradient, artist-facing
 *   client   — orange gradient, hirer-facing
 *   internal — flat near-black, team alerts
 */

/** Single source of truth for every absolute URL in an email.
 *
 *  NEVER build these from a request Origin header. Doing so is why live emails
 *  went out carrying localhost:3000 and manus.space links — the recipient is
 *  not the person whose browser made the request, so their origin is
 *  meaningless and often wrong. */
/** Fallback is the LIVE site. It used to be app.artswrk.com — the pre-cutover
 *  host — so with neither env var set (which is the case today) every email CTA
 *  pointed at the old site: "View my submissions" and friends landed people on
 *  the old login page. Every other module in the app already defaults to
 *  artswrk.com; this was the one that didn't. */
export const APP_URL =
  process.env.APP_URL || process.env.VITE_APP_URL || "https://artswrk.com";

export const FROM_EMAIL = "contact@artswrk.com";
export const FROM_NAME = "Artswrk";
export const SUPPORT_EMAIL = "support@artswrk.com";

/**
 * Logos, one per audience. PNG rather than SVG on purpose: Gmail strips SVG,
 * Outlook ignores it, Apple Mail is inconsistent — an email logo has to be a
 * raster image.
 *
 * Served from the app's own origin, so they only resolve once the build
 * carrying client/public/logos is deployed. There is no fallback: an <img> in
 * an email has no onError to lean on, so between merging this and shipping it,
 * transactional emails will show a broken logo. Deploy them together.
 */
export type Accent = "artist" | "client" | "internal";

const LOGO_BY_ACCENT: Record<Accent, string> = {
  artist: `${APP_URL}/logos/artswrk-pink.png`,
  client: `${APP_URL}/logos/artswrk-orange.png`,
  // Internal team alerts: either works, so they follow the client mark.
  internal: `${APP_URL}/logos/artswrk-orange.png`,
};


const PINK_BAND = "linear-gradient(90deg,#ec008c 0%,#ff7171 100%)";
const ORANGE_BAND = "linear-gradient(90deg,#FFBC5D 0%,#F25722 100%)";

const ACCENTS: Record<Accent, { band: string; flat: string }> = {
  // Audience decides the gradient, and it matches the wordmark above it: pink
  // for artists, orange for hirers. `flat` is the solid colour Outlook falls
  // back to, since it drops background-image entirely — without it the band
  // would render as a white gap.
  artist: { band: PINK_BAND, flat: "#ec008c" },
  client: { band: ORANGE_BAND, flat: "#F25722" },
  // Internal team alerts stay neutral — they aren't brand moments.
  internal: { band: "#111111", flat: "#111111" },
};

const INK = "#111111";
const MUTED = "#6b7280";
const PAGE = "#FAF8F5";
const CARD_BORDER = "#f0f0f0";
const DETAIL_BG = "#f9f9f9";
const FONT = "'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif";

export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/**
 * Strip legacy Bubble markup before anything user-authored reaches HTML.
 *
 * Old job descriptions carry BBCode (`[color=rgb(94,94,94)]…[/color]`), which
 * was leaking verbatim into live applicant-alert emails. This also flattens raw
 * HTML tags, because a description pasted from a rich-text editor would
 * otherwise inject markup straight into our layout.
 */
export function sanitizeUserText(input: string | null | undefined, maxLength?: number): string {
  let text = String(input ?? "");
  text = text.replace(/\[\/?[a-zA-Z][^\]]*\]/g, " ");   // BBCode, opening and closing
  text = text.replace(/<[^>]*>/g, " ");                  // stray HTML
  text = text.replace(/&nbsp;?/gi, " ");
  text = text.replace(/\s+/g, " ").trim();
  if (maxLength && text.length > maxLength) {
    const cut = text.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(" ");
    text = (lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut) + "…";
  }
  return text;
}

export interface DetailRow {
  label: string;
  /** Already-escaped-safe plain text. Rows with an empty value are dropped, so
   *  a missing field never renders as an empty "()" — a real bug in the old
   *  templates. */
  value: string | null | undefined;
}

/** The warm-gray label/value card used by nearly every email. */
export function detailsCard(rows: DetailRow[]): string {
  const live = rows.filter((r) => r.value != null && String(r.value).trim() !== "");
  if (!live.length) return "";
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${DETAIL_BG};border-radius:12px;margin:0 0 22px;">
        <tr><td style="padding:16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${live.map((r) => `
            <tr>
              <td style="font-family:${FONT};font-size:12px;font-weight:600;color:${MUTED};padding:5px 14px 5px 0;vertical-align:top;white-space:nowrap;">${esc(r.label)}</td>
              <td style="font-family:${FONT};font-size:14px;color:${INK};padding:5px 0;vertical-align:top;">${esc(r.value)}</td>
            </tr>`).join("")}
          </table>
        </td></tr>
      </table>`;
}

/** Black pill CTA. Bulletproof enough for Outlook: a table cell with a solid
 *  background, not a gradient, so the button never renders transparent. */
export function ctaButton(text: string, url: string): string {
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
        <tr><td align="center" bgcolor="${INK}" style="border-radius:999px;">
          <a href="${esc(url)}" style="display:inline-block;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:999px;">${esc(text)} &rarr;</a>
        </td></tr>
      </table>`;
}

export interface ShellOptions {
  accent: Accent;
  /** Big line at the top of the card. */
  headline: string;
  /** Pre-built HTML for the body. Anything user-authored must already have
   *  been through sanitizeUserText(). */
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  /** Small print under the CTA. */
  footerNote?: string;
  /** Hidden preheader — the grey line mail clients show next to the subject.
   *  Exactly one per email; the old message template rendered it twice. */
  preheader?: string;
  /** Set false on internal team alerts, which have no unsubscribe. */
  showUnsubscribe?: boolean;
}

export function renderEmailShell(o: ShellOptions): string {
  const accent = ACCENTS[o.accent];
  const showUnsub = o.showUnsubscribe !== false && o.accent !== "internal";

  // SendGrid raw-substitution tags. With dynamic templates gone {{unsubscribe}}
  // no longer resolves; these do, on any send carrying asm.groupId.
  const unsubBlock = showUnsub
    ? `<a href="<%asm_group_unsubscribe_raw_url%>" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>
         &nbsp;·&nbsp;
         <a href="<%asm_preferences_raw_url%>" style="color:${MUTED};text-decoration:underline;">Email preferences</a><br>`
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(o.headline)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
${o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};padding:28px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${CARD_BORDER};border-radius:16px;overflow:hidden;">

      <tr><td align="center" style="padding:26px 24px 20px;">
        <img src="${LOGO_BY_ACCENT[o.accent]}" alt="Artswrk" width="150" style="display:block;width:150px;max-width:150px;height:auto;border:0;">
      </td></tr>
      <tr><td bgcolor="${accent.flat}" style="background:${accent.flat};background-image:${accent.band};height:5px;line-height:5px;font-size:0;">&nbsp;</td></tr>

      <tr><td style="padding:30px 28px 26px;">
        <h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${INK};">${esc(o.headline)}</h1>
        <div style="font-family:${FONT};font-size:15px;line-height:1.62;color:#3f3f46;">
          ${o.bodyHtml}
        </div>
        ${o.ctaText && o.ctaUrl ? ctaButton(o.ctaText, o.ctaUrl) : ""}
        ${o.footerNote ? `<p style="margin:16px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">${o.footerNote}</p>` : ""}
      </td></tr>

      <tr><td style="padding:0 28px 26px;">
        <div style="border-top:1px solid ${CARD_BORDER};padding-top:18px;text-align:center;font-family:${FONT};font-size:12px;line-height:1.75;color:${MUTED};">
          <a href="mailto:${FROM_EMAIL}" style="color:${MUTED};text-decoration:none;">${FROM_EMAIL}</a>
          &nbsp;·&nbsp;
          <a href="https://instagram.com/artswrkofficial" style="color:${MUTED};text-decoration:none;">@artswrkofficial</a><br>
          ${unsubBlock}
          &copy; ${new Date().getFullYear()} Artswrk &reg;
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Paragraph helper — keeps body copy consistent across every sender. */
export function p(html: string): string {
  return `<p style="margin:0 0 15px;font-family:${FONT};font-size:15px;line-height:1.62;color:#3f3f46;">${html}</p>`;
}

/** Bold inline emphasis in body copy. */
export function b(text: unknown): string {
  return `<strong style="color:${INK};font-weight:650;">${esc(text)}</strong>`;
}

/** A quoted message from another person (applicant note, chat preview). */
export function quote(text: string): string {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr><td style="border-left:3px solid #e5e7eb;padding:2px 0 2px 14px;font-family:${FONT};font-size:14.5px;line-height:1.6;color:#52525b;font-style:italic;">
          &ldquo;${esc(text)}&rdquo;
        </td></tr>
      </table>`;
}
