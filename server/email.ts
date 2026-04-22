import sgMail from "@sendgrid/mail";

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ─── Template IDs ────────────────────────────────────────────────────────────
export const SENDGRID_TEMPLATES = {
  /** "Client - Request Posted" — sent after a job goes live */
  JOB_POSTED: "d-e2dcf8797ac545d68a03f610a7323fce",
  /** Password reset link email */
  PASSWORD_RESET: "d-password-reset-placeholder",
} as const;

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
  templateId,
  dynamicData,
}: {
  to: string;
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
      from: { email: FROM_EMAIL, name: FROM_NAME },
      templateId,
      dynamicTemplateData: dynamicData,
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
 * NOTE: While not live, all emails are redirected to ramitaravi.94@gmail.com.
 */
export async function sendApplicationConfirmationEmail({
  artistName,
  jobTitle,
  jobLocation,
  jobRate,
  jobUrl,
}: {
  artistName: string;
  jobTitle: string;
  jobLocation: string;
  jobRate: string;
  jobUrl: string;
}): Promise<boolean> {
  // ⚠️  PRE-LAUNCH: always send to test inbox, never to the real artist email
  const TO = "ramitaravi.94@gmail.com";

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
  artistName,
  artistEmail,
  jobTitle,
  jobLocation,
  jobRate,
  jobUrl,
  message,
  resumeLink,
}: {
  artistName: string;
  artistEmail: string;
  jobTitle: string;
  jobLocation: string;
  jobRate: string;
  jobUrl: string;
  message?: string;
  resumeLink?: string;
}): Promise<boolean> {
  // ⚠️  PRE-LAUNCH: always send to team inbox only
  const TO = "contact@artswrk.com";

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      <div style="margin-bottom:24px;">
        <span style="font-weight:900;font-size:22px;color:#F25722;">ARTS</span><span style="font-weight:900;font-size:22px;background:#111;color:#fff;padding:2px 6px;border-radius:4px;margin-left:2px;">WRK</span>
      </div>
      <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px;">New application received 📬</h2>
      <div style="background:#f9f9f9;border-radius:12px;padding:20px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:.05em;">Applicant</p>
        <p style="margin:0 0 4px;font-size:17px;font-weight:700;color:#111;">${artistName}</p>
        <p style="margin:0;font-size:14px;color:#555;">${artistEmail}</p>
        ${resumeLink ? `<p style="margin:8px 0 0;"><a href="${resumeLink}" style="color:#F25722;font-size:14px;">View Resume →</a></p>` : ""}
      </div>
      <div style="background:#fff3ee;border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #ffe0d0;">
        <p style="margin:0 0 6px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:.05em;">Job applied to</p>
        <p style="margin:0 0 4px;font-size:17px;font-weight:700;color:#111;">${jobTitle}</p>
        <p style="margin:0 0 4px;font-size:14px;color:#555;">📍 ${jobLocation}</p>
        <p style="margin:0;font-size:14px;color:#555;">💰 ${jobRate}</p>
      </div>
      ${message ? `<div style="background:#f9f9f9;border-radius:12px;padding:16px;margin-bottom:20px;"><p style="margin:0 0 6px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:.05em;">Cover message</p><p style="margin:0;font-size:14px;color:#333;white-space:pre-wrap;">${message}</p></div>` : ""}
      <a href="${jobUrl}" style="display:inline-block;background:#111;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">View Job →</a>
    </div>
  `;

  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[email] DEV — new applicant alert would send to ${TO}`);
    return false;
  }
  try {
    await sgMail.send({ to: TO, from: { email: FROM_EMAIL, name: FROM_NAME }, subject: `New applicant: ${artistName} → ${jobTitle}`, html });
    console.log(`[email] New applicant alert sent to ${TO}`);
    return true;
  } catch (err: unknown) {
    console.error("[email] Failed to send new applicant alert:", err instanceof Error ? err.message : err);
    return false;
  }
}

// ─── Simple raw HTML email ────────────────────────────────────────────────────
export async function sendSimpleEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("[email] SENDGRID_API_KEY not set — skipping email send");
    return false;
  }
  try {
    await sgMail.send({ to, from: { email: FROM_EMAIL, name: FROM_NAME }, subject, html });
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

// ─── Typed helper: Job Posted ─────────────────────────────────────────────────
export async function sendJobPostedEmail(data: JobPostedEmailData): Promise<boolean> {
  return sendTransactionalEmail({
    to: data.to,
    templateId: SENDGRID_TEMPLATES.JOB_POSTED,
    dynamicData: {
      subject: "Your job has been posted!",
      FirstName: data.firstName,
      Service: data.service,
      ArtistType: data.artistType,
      Date: data.date,
      Location: data.location,
      TransportDetails: data.transportDetails ?? "N/A",
      TransportReimbursed: data.transportReimbursed ?? "No",
      Description: data.description,
      joblink: data.jobLink,
    },
  });
}
