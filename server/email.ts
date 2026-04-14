import sgMail from "@sendgrid/mail";

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ─── Template IDs ────────────────────────────────────────────────────────────
export const SENDGRID_TEMPLATES = {
  /** "Client - Request Posted" — sent after a job goes live */
  JOB_POSTED: "d-e2dcf8797ac545d68a03f610a7323fce",
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
