import sgMail from "@sendgrid/mail";

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

// The account's one unsubscribe group ("Transactional emails", default).
// Required on every templated send so {{unsubscribe}}/{{unsubscribe_preferences}}
// actually resolve instead of rendering as raw placeholder text.
const ASM_GROUP_ID = 24547;

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
}: {
  to: string;
  cc?: string | string[];
  templateId: string;
  dynamicData: T;
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
      asm: { groupId: ASM_GROUP_ID },
    });
    console.log(`[email] Sent template ${templateId} to ${to}`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] Failed to send template ${templateId} to ${to}:`, message);
    return false;
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
 * Sent to contact@artswrk.com whenever someone applies to any job.
 * NEVER sent to the actual client — we are not live yet.
 */
export async function sendNewApplicantAlertEmail({
  to,
  artistName,
  artistEmail,
  jobTitle,
  jobLocation,
  jobRate,
  jobUrl,
  message,
  resumeLink,
}: {
  to: string;
  artistName: string;
  artistEmail: string;
  jobTitle: string;
  jobLocation: string;
  jobRate: string;
  jobUrl: string;
  message?: string;
  resumeLink?: string;
}): Promise<boolean> {
  const [firstName, ...lastParts] = artistName.trim().split(" ");
  const lastName = lastParts.join(" ");
  return sendTransactionalEmail({
    to,
    cc: "support@artswrk.com",
    templateId: SENDGRID_TEMPLATES.CLIENT_NEW_APPLICANT,
    dynamicData: {
      subject: `${artistName} is available for your job!`,
      ArtistName: firstName || artistName,
      ArtistLastName: lastName,
      ArtistType: "",
      Date: "",
      Description: "",
      Location: jobLocation,
      Message: message ?? "",
      Service: jobTitle,
      TransportDetails: "",
      TransportReimbursed: "",
      URL: jobUrl,
      link: jobUrl,
    },
  }).catch((err: unknown) => {
    console.error("[email] Failed to send new applicant alert:", err instanceof Error ? err.message : err);
    return false;
  });
}

// ─── Simple raw HTML email ────────────────────────────────────────────────────
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
            <p style="margin:0;color:#666;font-size:13px;line-height:1.5">To apply to jobs, we have two plans — <strong>Artswrk Basic ($30/year)</strong> and <strong>Artswrk PRO ($10.99/month or $110/year)</strong>. Our average booking on Basic is $250/booking — on PRO, you'll earn $500+ per job. One booking pays your subscription back!</p>
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
export async function sendJobPostedEmail(data: {
  to: string;
  firstName: string;
  /** Human-readable service type name e.g. "Substitute Teacher" */
  serviceType: string;
  date: string;
  location: string;
  rate: string;
  description: string;
  jobLink: string;
  transportation: boolean;
  /** Discipline/category, distinct from the job title — maps to {{ArtistType}}. Optional; the real template's field, not always available at every call site. */
  artistType?: string;
}): Promise<boolean> {
  return sendTransactionalEmail({
    to: data.to,
    cc: "support@artswrk.com",
    templateId: SENDGRID_TEMPLATES.JOB_POSTED,
    dynamicData: {
      subject: "Your job is live on Artswrk! 🎉",
      FirstName: data.firstName,
      Service: data.serviceType,
      ArtistType: data.artistType ?? "",
      Date: data.date,
      Location: data.location,
      TransportReimbursed: data.transportation ? "Yes" : "",
      TransportDetails: "",
      Description: data.description,
      joblink: data.jobLink,
    },
  });
}

// ─── PRO / Enterprise Job Posted Confirmation ─────────────────────────────────
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
 * Notify a user that they have a new message from someone on Artswrk.
 */
export async function sendNewMessageEmail({
  to,
  recipientFirstName,
  senderName,
  messagePreview,
  dashboardUrl,
  cc,
}: {
  to: string;
  recipientFirstName: string;
  senderName: string;
  messagePreview: string;
  dashboardUrl: string;
  /** Pass "support@artswrk.com" when the recipient is a client — every client-facing email gets CC'd. */
  cc?: string;
}) {
  const preview = messagePreview.length > 200 ? messagePreview.slice(0, 197) + "…" : messagePreview;
  const [senderFirstName, ...senderLastParts] = senderName.trim().split(" ");
  await sendTransactionalEmail({
    to,
    cc,
    templateId: SENDGRID_TEMPLATES.MESSAGE_RECEIVED,
    dynamicData: {
      // No `subject` field on this template — it builds its own subject line
      // from SenderFirstName/SenderLastName directly.
      SenderFirstName: senderFirstName || senderName,
      SenderLastName: senderLastParts.join(" "),
      MessageClip: preview,
      magic_link: dashboardUrl,
    },
  });
}

// ─── PRO Job: Alert to client when artist applies ────────────────────────────
export async function sendProJobApplicantAlertEmail(data: {
  to: string;
  artistFirstName: string;
  artistLastInitial: string;
  message: string | null;
  serviceType: string;
  location: string;
  description: string | null;
  jobLink: string;
}): Promise<boolean> {
  const descriptionText = data.description
    ? data.description.replace(/<[^>]*>/g, "").trim()
    : "";
  const artistDisplay = `${data.artistFirstName} ${data.artistLastInitial}.`;

  return sendTransactionalEmail({
    to: data.to,
    cc: "support@artswrk.com",
    templateId: SENDGRID_TEMPLATES.ENTERPRISE_NEW_APPLICANT,
    dynamicData: {
      subject: `${artistDisplay} is available for your job!`,
      ArtistName: data.artistFirstName,
      ArtistLastName: data.artistLastInitial,
      Description: descriptionText,
      Location: data.location,
      Message: data.message ?? "",
      Service: data.serviceType,
      URL: data.jobLink,
      link: data.jobLink,
    },
  });
}

// ─── PRO Job: Submission confirmation to artist ───────────────────────────────
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
export async function sendArtistBookingConfirmedEmail(data: {
  to: string;
  artistName: string;
  artistType: string;
  clientName: string;
  date: string;
  details: string;
  location: string;
  rate: string;
  serviceType: string;
  transportDetails?: string;
  transportReimbursed?: string;
  bookingUrl: string;
}): Promise<boolean> {
  return sendTransactionalEmail({
    to: data.to,
    templateId: SENDGRID_TEMPLATES.ARTIST_BOOKING_CONFIRMED,
    dynamicData: {
      subject: `You're confirmed for ${data.serviceType}!`,
      ArtistName: data.artistName,
      ArtistType: data.artistType,
      Client: data.clientName,
      Date: data.date,
      Details: data.details,
      Location: data.location,
      Rate: data.rate,
      Service: data.serviceType,
      TransportationDetails: data.transportDetails ?? "",
      TransportationReimbursement: data.transportReimbursed ?? "",
      URL: data.bookingUrl,
    },
  });
}

// ─── Booking confirmed: notify the client ─────────────────────────────────────
export async function sendClientBookingConfirmedEmail(data: {
  to: string;
  artistName: string;
  artistType: string;
  clientName: string;
  date: string;
  details: string;
  location: string;
  rate: string;
  serviceType: string;
  transportDetails?: string;
  transportReimbursed?: string;
  bookingUrl: string;
}): Promise<boolean> {
  return sendTransactionalEmail({
    to: data.to,
    cc: "support@artswrk.com",
    templateId: SENDGRID_TEMPLATES.CLIENT_BOOKING_CONFIRMED,
    dynamicData: {
      subject: `Booking confirmed with ${data.artistName}!`,
      ArtistName: data.artistName,
      ArtistType: data.artistType,
      Client: data.clientName,
      Date: data.date,
      Details: data.details,
      Location: data.location,
      Rate: data.rate,
      Service: data.serviceType,
      TransportationDetails: data.transportDetails ?? "",
      TransportationReimbursement: data.transportReimbursed ?? "",
      URL: data.bookingUrl,
    },
  });
}

// ─── Studio payment request: Client - Pay Artist ──────────────────────────────
export async function sendClientPayArtistEmail(data: {
  to: string;
  artistName: string;
  clientRate: string;
  date: string;
  reimbursements?: string;
  startDate: string;
  totalClientRate: string;
  payUrl: string;
}): Promise<boolean> {
  return sendTransactionalEmail({
    to: data.to,
    cc: "support@artswrk.com",
    templateId: SENDGRID_TEMPLATES.CLIENT_PAY_ARTIST,
    dynamicData: {
      subject: `Payment due for ${data.artistName}`,
      ArtistName: data.artistName,
      Client_Rate: data.clientRate,
      Date: data.date,
      Reimbursements: data.reimbursements ?? "",
      StartDate: data.startDate,
      Total_Client_Rate: data.totalClientRate,
      URL: data.payUrl,
    },
  });
}
