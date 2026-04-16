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
