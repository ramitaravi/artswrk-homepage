/**
 * JOB ALERT EMAIL TEMPLATES
 * ─────────────────────────────────────────────────────────────────────────────
 * Rendered here rather than as SendGrid dynamic templates, deliberately: the
 * HTML lives in the repo, is reviewable in a diff, and the dry-run script can
 * write the exact bytes a recipient would get to a file you can open. A
 * SendGrid-side template can't be previewed without sending something.
 *
 * Brand: the original spec's HTML used #5b3df5 purple, which is not an Artswrk
 * colour. These use the real lockup from the live password-reset email —
 * "ARTS" in #F25722 on white, "WRK" reversed out of #111.
 *
 * Field reality drives every fallback here (measured across active jobs):
 * title 55%, description 100%, service type 91%, locationCity 8%,
 * locationAddress 99%, startDate 98%, open rate 58%, hourly 40%, flat 2%.
 * Title is now required at posting, but migrated rows are all quarantined, so
 * the fallbacks below exist for defence rather than routine use.
 */

export interface JobCard {
  title: string;
  client: string | null;
  dateLabel: string | null;
  location: string | null;
  rateLabel: string | null;
  excerpt: string;
  applyUrl: string;
}

export interface ProCard {
  title: string;
  company: string | null;
  location: string | null;
  budget: string | null;
  excerpt: string;
  applyUrl: string;
}

export interface DigestData {
  firstName: string;
  jobs: JobCard[];
  totalMatchCount: number;
  proJobs: ProCard[];
  isProMember: boolean;
  jobsUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
}

const PINK = "#ec008c";
const PINK_2 = "#ff7171";
const INK = "#111111";
const MUTED = "#6b7280";
const HAIR = "#e9e9ee";

/** Hosted on the same CloudFront distribution the site nav uses, so it is
 *  already public and cached. 971x211 native; shown at 150px wide. */
const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artswrk-logo-gradient_8e560567.png";

/**
 * Gradient button. Outlook (Word rendering engine) ignores background-image
 * entirely, so `background` carries a flat PINK first and the gradient layers
 * on top for clients that support it — anyone on Outlook sees a solid pink
 * button rather than a transparent one with invisible text.
 */
function button(href: string, label: string, size: "md" | "lg" = "md"): string {
  const pad = size === "lg" ? "13px 30px" : "11px 26px";
  const fs = size === "lg" ? "15px" : "14px";
  return `<a href="${esc(href)}" style="display:inline-block;background:${PINK};background-image:linear-gradient(90deg,${PINK} 0%,${PINK_2} 100%);color:#ffffff;text-decoration:none;font-size:${fs};font-weight:700;padding:${pad};border-radius:8px;">${esc(label)}</a>`;
}

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

/** 2–3 lines, not the full description. The old Bubble digest pasted entire job
 *  descriptions and ran to enormous length; the cap is what keeps 10 cards
 *  scannable. */
export function excerpt(text: string | null | undefined, max = 180): string {
  const clean = String(text ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut) + "…";
}

const logo = `
      <div style="text-align:center;padding:4px 0 24px;">
        <img src="${LOGO_URL}" alt="Artswrk" width="150" style="display:inline-block;width:150px;max-width:150px;height:auto;border:0;outline:none;text-decoration:none;">
      </div>`;

const shell = (inner: string, footer: string) => `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f6f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
${logo}
${inner}
${footer}
  </div>
</body>
</html>`;

const footerBlock = (d: { preferencesUrl: string; unsubscribeUrl: string }) => `
    <div style="text-align:center;padding:22px 8px;font-size:12px;color:#9aa0a6;line-height:1.7;">
      You're getting this because your Artswrk job alerts are on.<br>
      <a href="${esc(d.preferencesUrl)}" style="color:${PINK};text-decoration:none;">Manage job alerts</a>
      &nbsp;·&nbsp;
      <a href="${esc(d.unsubscribeUrl)}" style="color:#9aa0a6;text-decoration:underline;">Unsubscribe from job alerts</a><br>
      <span style="color:#b6bcc2;">Unsubscribing here stops job alerts only — you'll still get booking confirmations and messages.</span><br>
      Artswrk · contact@artswrk.com
    </div>`;

const forwardBlock = `
      <div style="background:#f4f4f7;border-radius:12px;padding:14px 16px;margin-top:22px;text-align:center;">
        <div style="font-size:22px;line-height:1;margin-bottom:6px;">&#128231;</div>
        <div style="font-size:13.5px;color:#4b5563;line-height:1.55;">
          <b style="color:${INK};">Not available?</b> Forward this to someone who might be.
        </div>
      </div>`;

function jobCard(j: JobCard): string {
  const meta = [j.client, j.dateLabel].filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ");
  return `
      <div style="border:1px solid ${HAIR};border-radius:12px;padding:18px;margin-bottom:14px;background:#ffffff;">
        <div style="font-size:17px;font-weight:700;color:${INK};line-height:1.3;">${esc(j.title)}</div>
        ${meta ? `<div style="font-size:13px;color:${MUTED};margin-top:5px;">${meta}</div>` : ""}
        ${j.location ? `<div style="font-size:13px;color:${MUTED};margin-top:2px;">${esc(j.location)}</div>` : ""}
        ${j.rateLabel ? `<div style="font-size:14px;font-weight:700;color:${INK};margin-top:8px;">${esc(j.rateLabel)}</div>` : ""}
        ${j.excerpt ? `<div style="font-size:13px;color:#4b5563;line-height:1.55;margin-top:10px;">${esc(j.excerpt)}</div>` : ""}
        <div style="margin-top:14px;">${button(j.applyUrl, "Apply now")}</div>
      </div>`;
}

/**
 * PRO section. Membership decides how much of each job is shown and WHERE the
 * section sits — never who receives it.
 *
 * For a PRO member the section leads the email, above the regular jobs: they
 * pay $110/yr specifically for these, they are the highest-value listings on
 * the platform ($500+/booking), and burying them under ten regular cards wastes
 * the thing the subscription is for. For everyone else it stays below the
 * regular jobs as a teaser — putting a locked section first would open the
 * email on a wall.
 */
function proSectionPro(d: DigestData): string {
  if (!d.proJobs.length) return "";
  const n = d.proJobs.length;
  return `
      <div style="background:#fff5fa;border:2px solid ${PINK};border-radius:14px;padding:20px 18px;margin-bottom:26px;">
        <div style="text-align:center;margin-bottom:16px;">
          <span style="display:inline-block;background:${PINK};background-image:linear-gradient(90deg,${PINK} 0%,${PINK_2} 100%);color:#ffffff;font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;padding:6px 14px;border-radius:20px;">★ Your PRO jobs</span>
          <div style="font-size:19px;font-weight:800;color:${INK};margin-top:12px;line-height:1.3;">${n} PRO ${n === 1 ? "job" : "jobs"} open now</div>
          <div style="font-size:13px;color:#7a6470;margin-top:5px;">Premium listings, $500+ per booking. Members only — you're seeing these first.</div>
        </div>
        ${d.proJobs.map((p) => jobCard({
          title: p.title, client: p.company, dateLabel: null,
          location: p.location, rateLabel: p.budget, excerpt: p.excerpt, applyUrl: p.applyUrl,
        })).join("")}
      </div>`;
}

function proSectionTeaser(d: DigestData): string {
  if (!d.proJobs.length) return "";
  const n = d.proJobs.length;
  return `
      <div style="margin-top:26px;background:#fff5fa;border:1px solid #ffd0e8;border-radius:12px;padding:18px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${PINK};margin-bottom:10px;">🔒 ${n} PRO ${n === 1 ? "job" : "jobs"} you can't see yet</div>
        ${d.proJobs.map((p) => `<div style="font-size:14px;color:${INK};padding:5px 0;font-weight:600;">• ${esc(p.title)}</div>`).join("")}
        <div style="font-size:13px;color:#4b5563;margin-top:12px;line-height:1.55;">
          PRO jobs pay $500+ per booking. Unlock the client, location, rate and how to apply with Artswrk PRO — $110/yr, unlimited jobs, zero commission.
        </div>
        <div style="margin-top:12px;">${button("https://app.artswrk.com/pro", "Upgrade to PRO")}</div>
      </div>`;
}

export function renderDigest(d: DigestData): { subject: string; html: string } {
  const n = d.jobs.length;
  const subject =
    n === 1 ? "Artswrk: 1 new job near you" : `Artswrk: ${n} new jobs near you`;

  const overflow =
    d.totalMatchCount > d.jobs.length
      ? `<div style="text-align:center;margin-top:8px;">
           <a href="${esc(d.jobsUrl)}" style="font-size:14px;color:${PINK};font-weight:700;text-decoration:none;">See all ${d.totalMatchCount} jobs →</a>
         </div>`
      : "";

  const inner = `
    <div style="background:#ffffff;border-radius:14px;padding:26px 22px;">
      <h1 style="font-size:23px;font-weight:800;color:${INK};margin:0 0 4px;line-height:1.2;">New Jobs for You, ${esc(d.firstName)}</h1>
      <div style="font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${PINK};margin:0 0 14px;">Only on Artswrk</div>
      <p style="font-size:14px;color:${MUTED};margin:0 0 18px;line-height:1.55;">
        These match the services and area on your profile.
      </p>
      ${d.isProMember && d.proJobs.length ? `<div style="font-size:13px;color:${MUTED};margin:-6px 0 18px;">${d.jobs.length} regular ${d.jobs.length === 1 ? "job" : "jobs"} below your PRO listings.</div>` : ""}
      ${d.isProMember ? proSectionPro(d) : ""}
      ${d.jobs.map(jobCard).join("")}
      ${overflow}
      ${d.isProMember ? "" : proSectionTeaser(d)}
      ${forwardBlock}
    </div>`;

  return { subject, html: shell(inner, footerBlock(d)) };
}

export interface LastMinuteData {
  firstName: string;
  serviceName: string;
  title: string;
  client: string | null;
  whenLabel: string;
  location: string | null;
  transportationNote: string | null;
  rateLabel: string | null;
  excerpt: string;
  applyUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
}

export function renderLastMinute(d: LastMinuteData): { subject: string; html: string } {
  // Subject format carried over from the Bubble template.
  const subject = `LAST MINUTE Job Posted: ${d.serviceName} ${d.whenLabel}`;

  const row = (label: string, value: string) => `
        <tr>
          <td style="color:#9aa0a6;font-size:13px;padding:5px 14px 5px 0;vertical-align:top;white-space:nowrap;">${esc(label)}</td>
          <td style="color:${INK};font-size:14px;padding:5px 0;">${esc(value)}</td>
        </tr>`;

  const inner = `
    <div style="background:#ffffff;border-radius:14px;padding:26px 22px;border-top:4px solid ${PINK};">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;color:${PINK};margin-bottom:10px;">LAST MINUTE JOB</div>
      <h1 style="font-size:21px;font-weight:800;color:${INK};margin:0 0 6px;line-height:1.25;">${esc(d.title)}</h1>
      <p style="font-size:14px;color:${MUTED};margin:0 0 18px;line-height:1.55;">
        Hi ${esc(d.firstName)}, this starts within 48 hours and matches your profile. First to apply usually gets it.
      </p>
      <table style="border-collapse:collapse;margin-bottom:16px;">
        ${d.client ? row("Client", d.client) : ""}
        ${row("When", d.whenLabel)}
        ${d.location ? row("Where", d.location) : ""}
        ${d.transportationNote ? row("Travel", d.transportationNote) : ""}
        ${d.rateLabel ? row("Rate", d.rateLabel) : ""}
      </table>
      ${d.excerpt ? `<div style="font-size:13px;color:#4b5563;line-height:1.55;margin-bottom:18px;">${esc(d.excerpt)}</div>` : ""}
      ${button(d.applyUrl, "Apply now", "lg")}
      ${forwardBlock}
    </div>`;

  return { subject, html: shell(inner, footerBlock(d)) };
}
