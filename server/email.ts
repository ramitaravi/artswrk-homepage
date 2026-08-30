import sgMail from "@sendgrid/mail";
import {
  renderEmailShell, detailsCard, sanitizeUserText, p as para, b, quote,
  APP_URL, SUPPORT_EMAIL,
} from "./emailTemplates";

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ─── Dev/QA email redirect ──────────────────────────────────────────────────
// Set EMAIL_REDIRECT_TO in .env (never in production) to silently reroute every
// outgoing email to that one inbox instead of the real recipient — lets you Run
// As a real user's account locally and actually trigger their emails without
// spamming them. Original recipient is kept visible in the subject line. Only
// ever active outside NODE_ENV=production, regardless of what's set.
const EMAIL_REDIRECT_TO = process.env.NODE_ENV !== "production" ? process.env.EMAIL_REDIRECT_TO : undefined;
if (EMAIL_REDIRECT_TO) {
  console.warn(`[email] EMAIL_REDIRECT_TO is set — all outgoing email will be rerouted to ${EMAIL_REDIRECT_TO}`);
  const originalSend = sgMail.send.bind(sgMail);
  (sgMail as any).send = (data: any) => {
    const redirectOne = (msg: any) => {
      const realTo = msg.to;
      return {
        ...msg,
        to: EMAIL_REDIRECT_TO,
        cc: undefined,
        bcc: undefined,
        subject: `[to: ${typeof realTo === "string" ? realTo : JSON.stringify(realTo)}] ${msg.subject ?? ""}`,
      };
    };
    return originalSend(Array.isArray(data) ? data.map(redirectOne) : redirectOne(data));
  };
}

// ─── Template IDs ────────────────────────────────────────────────────────────
// Pulled directly from the SendGrid account via the API — these are the real,
// designed templates. Fields listed are each template's exact merge-field
// names (Handlebars {{Field}} placeholders in the live version's content).
export const SENDGRID_TEMPLATES = {
  /** "Client - Request Posted" — FirstName, Service, ArtistType, Date, Location, TransportDetails, TransportReimbursed, Description, joblink, subject */
  JOB_POSTED: "d-e2dcf8797ac545d68a03f610a7323fce",
  /** "Client - Artist Available For Your Job" — ArtistName, ArtistLastName, ArtistType, Date, Description, Location, Message, Service, TransportDetails, TransportReimbursed, URL, link, subject */
  CLIENT_NEW_APPLICANT: "d-0b9f0bd603c34da5b71e380acad0c35b",
  /** "Enterprise - Artist Available For Your Job" — ArtistName, ArtistLastName, Description, Location, Message, Service, URL, link, subject */
  ENTERPRISE_NEW_APPLICANT: "d-3960001d76fb4b4f977490fc2a73d2f6",
  /** "Artist / Client - Message Received" — SenderFirstName, SenderLastName, MessageClip, magic_link */
  MESSAGE_RECEIVED: "d-e3237d6a85da487b8865b0ff70d5e9f9",
  /** "Client - Booking Confirmed" — ArtistName, ArtistType, Client, Date, Details, Location, Rate, Service, TransportationDetails, TransportationReimbursement, URL, subject */
  CLIENT_BOOKING_CONFIRMED: "d-61d5e3a74692421383c8598e0a8559b1",
  /** "Artist - Booking Confirmed" — same fields as CLIENT_BOOKING_CONFIRMED */
  ARTIST_BOOKING_CONFIRMED: "d-6c4b6004194f41518dffa2827172d59f",
  /** "Client - Pay Artist" — ArtistName, Client_Rate, Date, Reimbursements, StartDate, Total_Client_Rate, URL, subject */
  CLIENT_PAY_ARTIST: "d-b68c3c35c9ab4fc89e3968cae3f757ce",
  /** Password reset link email */
  PASSWORD_RESET: "d-password-reset-placeholder",
} as const;

// SendGrid unsubscribe (ASM) groups. Required on every templated send so
// {{unsubscribe}}/{{unsubscribe_preferences}} actually resolve instead of
// rendering as raw placeholder text.
//
// "Transactional emails" — the account default. Booking confirmations, password
// resets, applicant alerts, messages. Unsubscribing here is a big hammer.
const ASM_GROUP_ID = 24547;

/**
 * "Job Alerts" — created 2026-08-29 for the automated job digest and
 * last-minute emails. Separate on purpose: a person who no longer wants job
 * alerts must be able to stop them WITHOUT also losing booking confirmations
 * and messages, which is exactly what unsubscribing from the shared
 * transactional group would have done.
 *
 * Every job alert send stamps this group, so SendGrid enforces its own
 * unsubscribes for it independently of ours.
 */
export const ASM_GROUP_JOB_ALERTS = 33079;

// ─── From address ─────────────────────────────────────────────────────────────
const FROM_EMAIL = "contact@artswrk.com";
const FROM_NAME = "Artswrk";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface JobPostedEmailData {
  /** Recipient email address */
  to: string;
  /** Recipient first name — maps to {{FirstName}} */
  firstName: string;
  /** Job service/title — maps to {{Service}} */
  service: string;
  /** Artist type — maps to {{ArtistType}} */
  artistType: string;
  /** Job date string — maps to {{Date}} */
  date: string;
  /** Job location string — maps to {{Location}} */
  location: string;
  /** Transport details — maps to {{TransportDetails}} */
  transportDetails?: string;
  /** Whether transport is reimbursed — maps to {{TransportReimbursed}} */
  transportReimbursed?: string;
  /** Full job description — maps to {{Description}} */
  description: string;
  /** Direct link to view the job — maps to {{joblink}} */
  jobLink: string;
}

// ─── Generic transactional email sender ──────────────────────────────────────
export async function sendTransactionalEmail<T extends Record<string, unknown>>({
  to,
  cc,
  templateId,
  dynamicData,
  asmGroupId,
}: {
  to: string;
  cc?: string | string[];
  templateId: string;
  dynamicData: T;
  /** Which unsubscribe group to stamp. Defaults to the shared transactional
   *  group; job alert sends pass ASM_GROUP_JOB_ALERTS so opting out of job
   *  emails doesn't also silence booking confirmations. */
  asmGroupId?: number;
}): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("[email] SENDGRID_API_KEY not set — skipping email send");
    return false;
  }

  try {
    await sgMail.send({
      to,
      ...(cc ? { cc } : {}),
      from: { email: FROM_EMAIL, name: FROM_NAME },
      templateId,
      dynamicTemplateData: dynamicData,
      asm: { groupId: asmGroupId ?? ASM_GROUP_ID },
    });
    console.log(`[email] Sent template ${templateId} to ${to}`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] Failed to send template ${templateId} to ${to}:`, message);
    return false;
  }
}

/**
 * Raw-HTML send, for mail whose body lives in this repo rather than in a
 * SendGrid dynamic template — currently the job alerts, whose HTML is in
 * server/jobAlerts/templates.ts so it can be diffed and previewed without
 * sending anything.
 *
 * Returns the provider message id on success so the send log can tie a later
 * bounce or complaint back to a specific message.
 */
export async function sendHtmlEmail({
  to,
  subject,
  html,
  asmGroupId,
  unsubscribeUrl,
}: {
  to: string;
  subject: string;
  html: string;
  asmGroupId?: number;
  /** Enables RFC 8058 one-click unsubscribe. Gmail and Yahoo require this of
   *  bulk senders — without it a "report spam" is often the only exit a
   *  recipient is offered, and complaint rate is what gets a domain blocked. */
  unsubscribeUrl?: string;
}): Promise<{ ok: boolean; messageId?: string }> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("[email] SENDGRID_API_KEY not set — skipping HTML email send");
    return { ok: false };
  }
  try {
    const [res] = await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      replyTo: FROM_EMAIL,
      subject,
      html,
      asm: { groupId: asmGroupId ?? ASM_GROUP_ID },
      trackingSettings: { clickTracking: { enable: true, enableText: false } },
      ...(unsubscribeUrl
        ? {
            headers: {
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              // Signals the URL accepts a POST, so the client can unsubscribe
              // silently instead of opening a browser tab.
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    });
    const messageId = (res?.headers as any)?.["x-message-id"];
    console.log(`[email] Sent "${subject}" to ${to}`);
    return { ok: true, messageId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] Failed to send "${subject}" to ${to}:`, message);
    return { ok: false };
  }
}

// ─── Typed helper: Password Reset ───────────────────────────────────────────
export async function sendPasswordResetEmail({
  to,
  firstName,
  resetUrl,
}: {
  to: string;
  firstName: string;
  resetUrl: string;
}): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("[email] SENDGRID_API_KEY not set — skipping password reset email");
    // In dev, log the reset URL so it can be used directly
    console.log(`[email] DEV reset URL: ${resetUrl}`);
    return false;
  }

  // Use a simple dynamic template or fall back to plain HTML email
  try {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: "Reset your Artswrk password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="margin-bottom: 24px;">
            <span style="font-weight: 900; font-size: 22px; color: #F25722;">ARTS</span><span style="font-weight: 900; font-size: 22px; background: #111; color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 2px;">WRK</span>
          </div>
          <h2 style="font-size: 20px; font-weight: 700; color: #111; margin-bottom: 8px;">Reset your password</h2>
          <p style="color: #555; font-size: 15px; margin-bottom: 24px;">Hi ${firstName},<br><br>We received a request to reset your Artswrk password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" style="display: inline-block; background: #F25722; color: #fff; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 8px; text-decoration: none;">Reset Password</a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
          <p style="color: #ccc; font-size: 12px; margin-top: 16px;">Or copy this link: <a href="${resetUrl}" style="color: #F25722;">${resetUrl}</a></p>
        </div>
      `,
    });
    console.log(`[email] Sent password reset email to ${to}`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] Failed to send password reset email to ${to}:`, message);
    return false;
  }
}

// ─── Typed helper: Application Confirmation (to artist) ─────────────────────
/**
 * Sent to the artist who just applied.
 */
export async function sendApplicationConfirmationEmail({
  to,
  artistName,
  jobTitle,
  jobLocation,
  jobRate,
  jobUrl,
}: {
  to: string;
  artistName: string;
  jobTitle: string;
  jobLocation: string;
  jobRate: string;
  jobUrl: string;
}): Promise<boolean> {
  const TO = to;

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      <div style="margin-bottom:24px;">
        <span style="font-weight:900;font-size:22px;color:#F25722;">ARTS</span><span style="font-weight:900;font-size:22px;background:#111;color:#fff;padding:2px 6px;border-radius:4px;margin-left:2px;">WRK</span>
      </div>
      <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px;">You applied! 🎉</h2>
      <p style="color:#555;font-size:15px;margin-bottom:20px;">Hi ${artistName},<br><br>Your application has been submitted. The hirer will review it and reach out if there's a match. Good luck!</p>
      <div style="background:#f9f9f9;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:.05em;">Job you applied to</p>
        <p style="margin:0 0 4px;font-size:17px;font-weight:700;color:#111;">${jobTitle}</p>
        <p style="margin:0 0 4px;font-size:14px;color:#555;">📍 ${jobLocation}</p>
        <p style="margin:0;font-size:14px;color:#555;">💰 ${jobRate}</p>
      </div>
      <a href="${jobUrl}" style="display:inline-block;background:#F25722;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">View Job →</a>
      <p style="color:#999;font-size:13px;margin-top:24px;">You'll hear from the hirer directly if they'd like to move forward. In the meantime, keep exploring jobs on <a href="https://artswrk.com/jobs" style="color:#F25722;">Artswrk</a>.</p>
    </div>
  `;

  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[email] DEV — application confirmation would send to ${TO}`);
    return false;
  }
  try {
    await sgMail.send({ to: TO, from: { email: FROM_EMAIL, name: FROM_NAME }, subject: `You applied to: ${jobTitle}`, html });
    console.log(`[email] Application confirmation sent to ${TO}`);
    return true;
  } catch (err: unknown) {
    console.error("[email] Failed to send application confirmation:", err instanceof Error ? err.message : err);
    return false;
  }
}

// ─── Typed helper: New Applicant Alert (to Artswrk team) ─────────────────────
/**
 * C3 — New applicant alert (regular job). Inline; replaces CLIENT_NEW_APPLICANT.
 *
 * jobUrl/resumeLink MUST be built from APP_URL by the caller, never the request
 * Origin — that is why live alerts on 2026-08-28 carried localhost:62958 links.
 */
export async function sendNewApplicantAlertEmail({
  to, artistName, artistEmail, jobTitle, jobLocation, jobRate, jobUrl, message, resumeLink, cc,
}: {
  to: string; artistName: string; artistEmail?: string; jobTitle: string;
  jobLocation?: string; jobRate?: string; jobUrl: string;
  message?: string; resumeLink?: string; cc?: string;
}): Promise<boolean> {
  const note = sanitizeUserText(message, 500);
  const html = renderEmailShell({
    accent: "client",
    headline: artistName + " is available for your job!",
    preheader: artistName + " applied to " + jobTitle + ".",
    bodyHtml:
      para("Hi there, " + b(artistName) + " is interested in the job below.") +
      (note ? para("Message from " + b(artistName) + ":") + quote(note) : "") +
      detailsCard([
        { label: "Job", value: jobTitle },
        { label: "Location", value: jobLocation },
        { label: "Rate", value: jobRate },
        { label: "Contact", value: artistEmail },
      ]),
    ctaText: "View Submission",
    ctaUrl: jobUrl,
    footerNote: resumeLink
      ? '<a href="' + resumeLink + '" style="color:#F25722;font-weight:600;">View ' + artistName + '\u2019s resume &rarr;</a>'
      : undefined,
  });
  return sendSimpleEmail({ to, cc: cc ?? SUPPORT_EMAIL, subject: artistName + " is available for your job!", html });
}
export async function sendSimpleEmail({
  to,
  subject,
  html,
  cc,
}: {
  to: string;
  subject: string;
  html: string;
  cc?: string | string[];
}): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("[email] SENDGRID_API_KEY not set — skipping email send");
    return false;
  }
  try {
    await sgMail.send({ to, from: { email: FROM_EMAIL, name: FROM_NAME }, subject, html, ...(cc ? { cc } : {}) });
    return true;
  } catch (err: unknown) {
    console.error("[email] Failed to send simple email:", err instanceof Error ? err.message : err);
    return false;
  }
}

// ─── Artist Welcome Email ─────────────────────────────────────────────────────
export async function sendArtistWelcomeEmail({
  to,
  firstName,
}: {
  to: string;
  firstName: string;
}): Promise<boolean> {
  const appUrl = process.env.VITE_APP_URL || "https://artswrk.com";
  return sendSimpleEmail({
    to,
    subject: "Welcome to Artswrk! 🎉",
    html: `
      <div style="font-family:'Helvetica Neue',sans-serif;max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f0f0f0">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#FFBC5D,#F25722);padding:32px 40px">
          <div style="display:inline-flex;align-items:center;gap:6px">
            <span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px">ARTS</span>
            <span style="font-size:22px;font-weight:900;background:#111;color:#fff;padding:2px 8px;border-radius:6px">WRK</span>
          </div>
        </div>

        <!-- Body -->
        <div style="padding:40px">
          <h1 style="font-size:24px;font-weight:900;color:#111;margin:0 0 8px">Hey ${firstName},</h1>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 20px">
            Thanks for joining Artswrk! We're so glad you're here.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 28px">
            Artswrk was built <strong>for artists by artists</strong> — our mission is to shatter the starving artist stigma. We help you pay your bills with part-time work when you need it most.
          </p>

          <h2 style="font-size:16px;font-weight:800;color:#111;margin:0 0 16px">Here's how to get started:</h2>

          <div style="border-left:3px solid #FFBC5D;padding:12px 16px;margin-bottom:16px;background:#fffdf9;border-radius:0 8px 8px 0">
            <p style="margin:0 0 4px;font-weight:700;color:#111;font-size:14px">🎨 Create Your Profile</p>
            <p style="margin:0;color:#666;font-size:13px;line-height:1.5">Build a custom profile with your bio, services, and skillsets. Share the link in your bio so potential employers can see what you do best!</p>
          </div>

          <div style="border-left:3px solid #F25722;padding:12px 16px;margin-bottom:16px;background:#fffbf9;border-radius:0 8px 8px 0">
            <p style="margin:0 0 4px;font-weight:700;color:#111;font-size:14px">🔍 Browse Jobs</p>
            <p style="margin:0;color:#666;font-size:13px;line-height:1.5">We have hundreds of jobs to choose from — from creative work to side jobs. Something new is posted every day.</p>
          </div>

          <div style="border-left:3px solid #FFBC5D;padding:12px 16px;margin-bottom:28px;background:#fffdf9;border-radius:0 8px 8px 0">
            <p style="margin:0 0 4px;font-weight:700;color:#111;font-size:14px">💳 Choose Your Plan</p>
            <p style="margin:0;color:#666;font-size:13px;line-height:1.5">Choose your plan: <strong>Basic ($30/year)</strong> or <strong>PRO ($110/year — annual only, and it starts with a 7-day free trial)</strong>. No commission on anything you earn, ever — discuss your rate freely with clients. Our average Basic booking is $250; on PRO it's $500+. One booking pays the year off.</p>
          </div>

          <a href="${appUrl}/app" style="display:inline-block;background:linear-gradient(90deg,#FFBC5D,#F25722);color:#fff;font-weight:800;font-size:14px;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:32px">
            Go to My Dashboard →
          </a>

          <hr style="border:none;border-top:1px solid #f0f0f0;margin:0 0 24px" />

          <p style="color:#888;font-size:13px;line-height:1.6;margin:0">
            If you have questions, email us at <a href="mailto:contact@artswrk.com" style="color:#F25722">contact@artswrk.com</a>. We're happy to help or hear feedback to make your experience the best it can be.
          </p>
          <p style="color:#888;font-size:13px;margin:16px 0 0">
            Best,<br />
            <strong style="color:#111">Nick &amp; Rami</strong><br />
            Co-Founders, Artswrk
          </p>
        </div>
      </div>
    `,
  });
}

// ─── Job Posted Confirmation (regular jobs) ───────────────────────────────────
/**
 * C1 — Job posted confirmation (regular). Inline; replaces the JOB_POSTED
 * dynamic template, which rendered literal "*Service:*" asterisks and empty
 * "()" rows for missing fields on 2026-08-28.
 */
export async function sendJobPostedEmail(data: {
  to: string; firstName: string; serviceType: string; date: string;
  location: string; rate: string; description: string; jobLink: string;
  transportation: boolean; artistType?: string; transportDetails?: string;
}): Promise<boolean> {
  const html = renderEmailShell({
    accent: "client",
    headline: "Your job is live! \u{1F389}",
    preheader: "Artists can start applying now.",
    bodyHtml:
      para("Hey " + b(data.firstName) + ", your job posting is now live on Artswrk and artists can start applying.") +
      detailsCard([
        { label: "Service", value: data.serviceType },
        { label: "Date", value: data.date },
        { label: "Location", value: data.location },
        { label: "Rate", value: data.rate },
        { label: "Transportation", value: data.transportation ? (data.transportDetails || "Reimbursed") : null },
        // Sanitized: old Bubble descriptions carry BBCode that leaked raw.
        { label: "Details", value: sanitizeUserText(data.description, 400) },
      ]),
    ctaText: "View Your Job Posting",
    ctaUrl: data.jobLink,
    footerNote: 'We\u2019ll email you the moment an artist applies. Questions? <a href="mailto:contact@artswrk.com" style="color:#6b7280;">contact@artswrk.com</a>',
  });
  return sendSimpleEmail({ to: data.to, cc: SUPPORT_EMAIL, subject: "Your job is live on Artswrk! \u{1F389}", html });
}
export async function sendProJobPostedEmail(data: {
  to: string;
  firstName: string;
  company: string;
  serviceType: string;
  location: string | null;
  description: string | null;
  workFromAnywhere: boolean;
  jobLink: string;
}): Promise<boolean> {
  const locationDisplay = data.workFromAnywhere
    ? "Open to Traveling Applicants"
    : data.location || "Location TBD";

  // Keep basic formatting tags, strip everything else, then truncate to ~350 chars
  const sanitizedDescription = data.description
    ? data.description
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<(?!\/?(?:p|br|strong|b|em|i|ul|ol|li|h[1-6])(?:\s|\/|>))[^>]*>/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
    : null;

  // Text-only version for truncation check
  const plainLength = sanitizedDescription
    ? sanitizedDescription.replace(/<[^>]*>/g, "").length
    : 0;

  // If description is long, show a truncated plain-text excerpt with ellipsis
  const descriptionHtml = sanitizedDescription
    ? plainLength > 400
      ? `<p style="font-size:13px;color:#555;line-height:1.7;margin:0">${sanitizedDescription.replace(/<[^>]*>/g, "").slice(0, 380).trimEnd()}…</p>`
      : `<div style="font-size:13px;color:#555;line-height:1.7">${sanitizedDescription}</div>`
    : null;

  return sendSimpleEmail({
    to: data.to,
    cc: "support@artswrk.com",
    subject: `Your job has been posted — ${data.serviceType} at ${data.company}`,
    html: `
      <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f0f0f0">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#FFBC5D,#F25722);padding:28px 36px">
          <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/ArtswrkWhiteLogo_d14af74c.png"
               alt="Artswrk" height="36" style="display:block;height:36px;width:auto;margin-bottom:8px" />
          <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:0;font-weight:500">Job Posted · ${data.company}</p>
        </div>

        <!-- Body -->
        <div style="padding:36px">
          <p style="font-size:15px;color:#111;margin:0 0 6px">Hey ${data.firstName},</p>
          <p style="font-size:15px;font-weight:700;color:#111;margin:0 0 24px">Your job has been posted! See details below:</p>

          <!-- Job card -->
          <div style="background:#f9f9f9;border-radius:12px;padding:20px 24px;margin-bottom:28px">
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="padding:5px 16px 5px 0;font-size:13px;font-weight:700;color:#111;vertical-align:top;white-space:nowrap;width:110px">Job</td>
                <td style="padding:5px 0;font-size:14px;color:#333;font-weight:600">${data.serviceType}</td>
              </tr>
              <tr>
                <td style="padding:5px 16px 5px 0;font-size:13px;font-weight:700;color:#111;vertical-align:top;white-space:nowrap">Company</td>
                <td style="padding:5px 0;font-size:14px;color:#333">${data.company}</td>
              </tr>
              <tr>
                <td style="padding:5px 16px 5px 0;font-size:13px;font-weight:700;color:#111;vertical-align:top;white-space:nowrap">Location</td>
                <td style="padding:5px 0;font-size:14px;color:#333">${locationDisplay}</td>
              </tr>
              ${descriptionHtml ? `
              <tr>
                <td colspan="2" style="padding:12px 0 0">
                  <div style="border-top:1px solid #e8e8e8;padding-top:12px">
                    <p style="font-size:13px;font-weight:700;color:#111;margin:0 0 6px">Description</p>
                    ${descriptionHtml}
                  </div>
                </td>
              </tr>` : ""}
            </table>
          </div>

          <!-- Big CTA button -->
          <div style="text-align:center;margin-bottom:28px">
            <a href="${data.jobLink}"
               style="display:inline-block;background:linear-gradient(135deg,#FFBC5D,#F25722);color:#fff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 36px;border-radius:100px;letter-spacing:-0.2px">
              View Your Job →
            </a>
          </div>

          <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 20px">
            Artists are now able to apply. You can manage applicants and job details from your enterprise dashboard.
          </p>

          <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 28px">
            Questions? Email us at <a href="mailto:contact@artswrk.com" style="color:#F25722;text-decoration:none;font-weight:600">contact@artswrk.com</a>.
          </p>

          <hr style="border:none;border-top:1px solid #f0f0f0;margin:0 0 20px" />
          <p style="font-size:13px;color:#999;margin:0">— The Artswrk Team</p>
        </div>
      </div>
    `,
  });
}

/**
 * A5 — New message notification. Inline; replaces MESSAGE_RECEIVED.
 *
 * Two fixes carried over from the template: the sender name arrives as ONE
 * display string (the template concatenated first+last, producing "Street Beatz
 * Street Beatz"), and the preview appears exactly once — the template rendered
 * it in both the preheader and the body.
 */
export async function sendNewMessageEmail({
  to, cc, recipientFirstName, senderName, messagePreview, dashboardUrl,
}: {
  to: string; recipientFirstName: string; senderName: string;
  messagePreview: string; dashboardUrl: string; cc?: string;
}): Promise<boolean> {
  const preview = sanitizeUserText(messagePreview, 200);
  const html = renderEmailShell({
    accent: "artist",
    headline: "You have a new message \u{1F4AC}",
    preheader: senderName + " sent you a message on Artswrk.",
    bodyHtml:
      para("Hi " + b(recipientFirstName) + ",") +
      para("From " + b(senderName) + ":") +
      (preview ? quote(preview) : ""),
    ctaText: "Reply on Artswrk",
    ctaUrl: dashboardUrl || (APP_URL + "/app/messages"),
    footerNote: "Please keep communication on Artswrk \u2014 it\u2019s covered by the Terms &amp; Conditions and protects both sides.",
  });
  return sendSimpleEmail({ to, cc, subject: senderName + " just sent you a message!", html });
}
/**
 * C4 — New applicant alert (PRO/enterprise). Inline; replaces
 * ENTERPRISE_NEW_APPLICANT. Job details are sanitized — enterprise job bodies
 * carry the same Bubble BBCode.
 */
export async function sendProJobApplicantAlertEmail(data: {
  to: string; artistFirstName: string; artistLastInitial: string;
  message: string | null; serviceType: string; location: string;
  description: string | null; jobLink: string;
}): Promise<boolean> {
  const who = (data.artistFirstName + " " + data.artistLastInitial + ".").trim();
  const note = sanitizeUserText(data.message, 500);
  const html = renderEmailShell({
    accent: "client",
    headline: who + " is available for your job!",
    preheader: who + " applied to " + data.serviceType + ".",
    bodyHtml:
      para("Hi there, " + b(who) + " is interested in the job below.") +
      (note ? para("Message from " + b(who) + ":") + quote(note) : "") +
      detailsCard([
        { label: "Job", value: data.serviceType },
        { label: "Location", value: data.location },
        { label: "Details", value: sanitizeUserText(data.description, 400) },
      ]),
    ctaText: "View Submission",
    ctaUrl: data.jobLink,
    footerNote: "You can view interested artists and their profiles from your enterprise dashboard. Need more information before confirming? Message them on Artswrk.",
  });
  return sendSimpleEmail({ to: data.to, cc: SUPPORT_EMAIL, subject: who + " is available for your job!", html });
}
export async function sendProJobSubmissionConfirmationEmail(data: {
  to: string;
  artistFirstName: string;
  serviceType: string;
  location: string;
  description: string | null;
  dashboardLink: string;
}): Promise<boolean> {
  const descriptionText = data.description
    ? data.description.replace(/<[^>]*>/g, "").trim()
    : null;

  return sendSimpleEmail({
    to: data.to,
    cc: "support@artswrk.com",
    subject: `Your submission has been received!`,
    html: `
      <div style="font-family:'Helvetica Neue',sans-serif;max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f0f0f0">
        <div style="background:linear-gradient(135deg,#FFBC5D,#F25722);padding:28px 36px">
          <div style="display:inline-flex;align-items:center;gap:6px">
            <span style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.5px">ARTS</span>
            <span style="font-size:20px;font-weight:900;background:#111;color:#fff;padding:2px 8px;border-radius:6px">WRK</span>
          </div>
        </div>
        <div style="padding:36px">
          <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 6px">Hi ${data.artistFirstName},</p>
          <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 28px">
            Your submission to the job below has been sent over to the client — once they confirm you or request more information, you will receive a notification!
          </p>
          <div style="background:#f9f9f9;border-radius:12px;padding:20px 24px;margin-bottom:28px">
            <p style="font-size:13px;font-weight:800;color:#111;margin:0 0 14px">Job Details</p>
            <p style="font-size:14px;color:#111;margin:0 0 8px"><strong>Service:</strong> ${data.serviceType}</p>
            <p style="font-size:14px;color:#111;margin:0 0 8px"><strong>Location:</strong> ${data.location}</p>
            ${descriptionText ? `<p style="font-size:14px;color:#111;margin:0"><strong>Details:</strong> ${descriptionText}</p>` : ""}
          </div>
          <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px">
            If you have any questions or concerns, don't hesitate to reach out to us. You can always check on your submissions in your <a href="${data.dashboardLink}" style="color:#F25722;font-weight:700">artist dashboard</a>.
          </p>
          <hr style="border:none;border-top:1px solid #f0f0f0;margin:0 0 20px" />
          <p style="font-size:14px;color:#111;margin:0">Best,<br/>The Artswrk Team</p>
        </div>
      </div>
    `,
  });
}

// ─── Booking confirmed: notify the artist ─────────────────────────────────────
/** A6 — Booking confirmed, artist. Inline; replaces ARTIST_BOOKING_CONFIRMED. */
export async function sendArtistBookingConfirmedEmail(data: {
  to: string; artistName: string; artistType?: string; clientName: string;
  date: string; details?: string; location: string; rate: string;
  serviceType: string; transportDetails?: string; transportReimbursed?: string;
  bookingUrl: string;
}): Promise<boolean> {
  const html = renderEmailShell({
    accent: "artist",
    headline: "You\u2019re confirmed! \u{1F389}",
    preheader: data.clientName + " confirmed you for " + data.serviceType + ".",
    bodyHtml:
      para("Hi " + b(data.artistName) + ", " + b(data.clientName) + " has confirmed you for " + data.serviceType + ".") +
      detailsCard([
        { label: "Service", value: data.serviceType },
        { label: "Date", value: data.date },
        { label: "Location", value: data.location },
        { label: "Rate", value: data.rate },
        { label: "Transportation", value: data.transportReimbursed ? (data.transportDetails || "Reimbursed") : data.transportDetails },
        { label: "Details", value: sanitizeUserText(data.details, 400) },
      ]),
    ctaText: "View Booking",
    ctaUrl: data.bookingUrl,
    footerNote: "If anything looks off, message the client on Artswrk or email us.",
  });
  return sendSimpleEmail({ to: data.to, subject: "You\u2019re confirmed for " + data.serviceType + "!", html });
}
/** C5 — Booking confirmed, client. Inline; replaces CLIENT_BOOKING_CONFIRMED. */
export async function sendClientBookingConfirmedEmail(data: {
  to: string; artistName: string; artistType?: string; clientName?: string;
  date: string; details?: string; location: string; rate: string;
  serviceType: string; transportDetails?: string; transportReimbursed?: string;
  bookingUrl: string;
}): Promise<boolean> {
  const html = renderEmailShell({
    accent: "client",
    headline: "Booking confirmed! \u{1F389}",
    preheader: "You\u2019re all set with " + data.artistName + ".",
    bodyHtml:
      para("You\u2019re all set with " + b(data.artistName) + " for " + data.serviceType + ".") +
      detailsCard([
        { label: "Artist", value: data.artistName },
        { label: "Date", value: data.date },
        { label: "Location", value: data.location },
        { label: "Rate", value: data.rate },
        { label: "Transportation", value: data.transportReimbursed ? (data.transportDetails || "Reimbursed") : data.transportDetails },
        { label: "Details", value: sanitizeUserText(data.details, 400) },
      ]),
    ctaText: "View Booking",
    ctaUrl: data.bookingUrl,
    footerNote: "Need to change anything? Message " + data.artistName + " on Artswrk.",
  });
  return sendSimpleEmail({ to: data.to, cc: SUPPORT_EMAIL, subject: "Booking confirmed with " + data.artistName + "!", html });
}
/**
 * C6 — Pay artist request. Inline; replaces CLIENT_PAY_ARTIST.
 *
 * Leads with the amount and one button. The old Bubble wording ("PAYMENT
 * DETAILS / edit your payment details") read like an account-settings prompt
 * and left people unsure anything was owed.
 */
export async function sendClientPayArtistEmail(data: {
  to: string; clientName?: string; artistName: string; clientRate: string;
  date: string; reimbursements?: string; startDate?: string;
  totalClientRate: string; payUrl: string;
}): Promise<boolean> {
  const total = "$" + String(data.totalClientRate).replace(/^\$/, "");
  const html = renderEmailShell({
    accent: "client",
    headline: "Payment due for " + data.artistName,
    preheader: "Total due: " + total,
    bodyHtml:
      para("Hi " + b(data.clientName || "there") + ", " + b(data.artistName) + "\u2019s booking is complete and payment is due.") +
      detailsCard([
        { label: "Date", value: data.date || data.startDate },
        { label: "Rate", value: data.clientRate },
        { label: "Reimbursements", value: data.reimbursements },
        { label: "Total due", value: total },
      ]) +
      para("Pay in a minute by card or Apple Pay \u2014 you\u2019ll get a receipt as soon as it processes."),
    ctaText: "Pay " + data.artistName,
    ctaUrl: data.payUrl,
  });
  return sendSimpleEmail({ to: data.to, cc: SUPPORT_EMAIL, subject: "Payment due for " + data.artistName, html });
}

// ─── New builds — previously sent only by old Bubble, or not at all ─────────

/**
 * A2 — Welcome to Artswrk PRO. NEW: old Bubble was the only sender, and its
 * version had schemeless (dead) links, "PRO!Â" mojibake, and was signed by one
 * founder. Copy below is the approved rewrite.
 */
export async function sendProWelcomeEmail({
  to, firstName,
}: { to: string; firstName: string }): Promise<boolean> {
  const html = renderEmailShell({
    accent: "artist",
    headline: "Welcome to Artswrk PRO \u{1F48E}",
    preheader: "Jobs PRO and the Benefits Portal are unlocked.",
    bodyHtml:
      para("Hey " + b(firstName) + ",") +
      para("Welcome to PRO — " + b("$110 for the year") + ", unlimited jobs, zero commission. What you and the client agree on is what you earn, so discuss your rate freely.") +
      para("Here's what you just unlocked:") +
      para(b("1. Jobs PRO") + " — the highest-value jobs on Artswrk ($500+ average booking), direct client messaging, and priority placement.") +
      para(b("2. The Benefits Portal") + " — exclusive offers from vetted organizations: 1:1 health insurance and sick pay consults, plus discounts built for freelance artists.") +
      para("One PRO booking pays for the year. Go get it."),
    ctaText: "Explore Jobs PRO",
    ctaUrl: `${APP_URL}/app/pro`,
    footerNote: `Or head straight to the <a href="${APP_URL}/app/benefits" style="color:#ec008c;font-weight:600;">Benefits Portal &rarr;</a><br><br>Questions? Just reply to this email — a human reads it.<br>Best,<br>Nick &amp; Rami, Co-Founders, Artswrk`,
  });
  return sendSimpleEmail({ to, subject: "Welcome to Artswrk PRO \u{1F48E}", html });
}

/**
 * A11 — Payout notification. NEW on this site; the copy is kept from the old
 * Bubble email because artists liked it, with the wallet link corrected.
 * It points at /app/payments — the old /app?tab=payment is ignored by the new
 * app and silently dropped people on the dashboard.
 */
export async function sendPayoutOnTheWayEmail({
  to, firstName, clientName, date, location, amount,
}: {
  to: string; firstName: string; clientName: string;
  date: string; location?: string; amount: string;
}): Promise<boolean> {
  const html = renderEmailShell({
    accent: "artist",
    headline: "Your payment is on its way! \u{1F4B8}",
    preheader: `${clientName} paid you for your booking on ${date}.`,
    bodyHtml:
      para("Hey " + b(firstName) + ",") +
      para(b(clientName) + " just paid you for your booking on " + date + ". The money will hit your bank account in a couple of days (as fast as your bank moves).") +
      para("Your earnings are already showing in your Artswrk Wallet.") +
      detailsCard([
        { label: "Date", value: date },
        { label: "Location", value: location },
        { label: "Amount", value: `$${String(amount).replace(/^\$/, "")}` },
      ]),
    ctaText: "View My Wallet",
    ctaUrl: `${APP_URL}/app/payments`,
    footerNote: "Best,<br>The Artswrk Team",
  });
  return sendSimpleEmail({ to, subject: "Your payment is on its way! \u{1F4B8}", html });
}

/**
 * C9 — Client payment receipt. NEW: without it, clients get only Stripe's
 * generic receipt once Bubble stops sending.
 */
export async function sendClientPaymentReceiptEmail({
  to, firstName, artistName, date, rate, reimbursements, total,
}: {
  to: string; firstName: string; artistName: string; date: string;
  rate?: string; reimbursements?: string; total: string;
}): Promise<boolean> {
  const html = renderEmailShell({
    accent: "client",
    headline: `Payment confirmed — ${artistName}`,
    preheader: `Your payment for ${artistName}'s booking went through.`,
    bodyHtml:
      para("Hi " + b(firstName) + ",") +
      para("Your payment for " + b(artistName) + "'s booking on " + date + " went through. Thanks for paying on time — artists feel it.") +
      detailsCard([
        { label: "Date", value: date },
        { label: "Rate", value: rate },
        { label: "Reimbursements", value: reimbursements },
        { label: "Total paid", value: `$${String(total).replace(/^\$/, "")}` },
      ]),
    ctaText: "View My Bookings",
    ctaUrl: `${APP_URL}/app`,
    footerNote: 'Questions? <a href="mailto:contact@artswrk.com" style="color:#6b7280;">contact@artswrk.com</a><br>Best,<br>The Artswrk Team',
  });
  return sendSimpleEmail({ to, cc: SUPPORT_EMAIL, subject: `Payment confirmed — ${artistName} on ${date}`, html });
}

/**
 * C7 — Payment reminder. NEW. The trigger (an unpaid-invoice sweep) does not
 * exist yet; this renders the email so the scheduled job only has to call it.
 */
export async function sendPaymentReminderEmail({
  to, firstName, artistName, date, total, payUrl,
}: {
  to: string; firstName: string; artistName: string;
  date: string; total: string; payUrl: string;
}): Promise<boolean> {
  const amount = `$${String(total).replace(/^\$/, "")}`;
  const html = renderEmailShell({
    accent: "client",
    headline: `Payment due for ${artistName}`,
    preheader: `Total due: ${amount}`,
    bodyHtml:
      para("Hi " + b(firstName) + ",") +
      para("Quick nudge — " + b(artistName) + "'s booking on " + date + " is complete and payment is still open.") +
      detailsCard([
        { label: "Date", value: date },
        { label: "Total due", value: amount },
      ]) +
      para("Pay in a minute by card or Apple Pay. You'll get a receipt as soon as it processes."),
    ctaText: "Pay Now",
    ctaUrl: payUrl,
    footerNote: 'Questions? <a href="mailto:contact@artswrk.com" style="color:#6b7280;">contact@artswrk.com</a><br>Best,<br>The Artswrk Team',
  });
  return sendSimpleEmail({ to, cc: SUPPORT_EMAIL, subject: `Reminder — payment due for ${artistName} | ${date}`, html });
}

/**
 * I3 — Internal subscription-change alert. NEW; Bubble sends this today.
 * Internal accent, no unsubscribe — it goes to the team, not a customer.
 */
export async function sendInternalSubscriptionAlert({
  userName, userEmail, plan, role,
}: { userName: string; userEmail: string; plan: string; role?: string }): Promise<boolean> {
  const html = renderEmailShell({
    accent: "internal",
    headline: "Subscription updated",
    showUnsubscribe: false,
    bodyHtml:
      para("Hey team,") +
      para(b(userName) + " is now on: " + b(plan)) +
      detailsCard([
        { label: "Email", value: userEmail },
        { label: "Plan", value: plan },
        { label: "Role", value: role },
      ]),
  });
  return sendSimpleEmail({ to: "contact@artswrk.com", subject: "Subscription Updated!", html });
}
