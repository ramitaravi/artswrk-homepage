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
/**
 * S1 — Password reset.
 *
 * The reset URL is built by the caller from APP_URL, never a request Origin —
 * a real send on 2026-08-25 carried localhost:3000 and an April one carried the
 * manus.space staging host.
 */
export async function sendPasswordResetEmail({
  to, firstName, resetUrl,
}: { to: string; firstName: string; resetUrl: string }): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("[email] SENDGRID_API_KEY not set — skipping password reset email");
    console.log("[email] DEV reset URL: " + resetUrl);
    return false;
  }
  const html = renderEmailShell({
    accent: "artist",
    headline: "Reset your password",
    preheader: "This link expires in 1 hour.",
    bodyHtml:
      para("Hi " + b(firstName) + ",") +
      para("We received a request to reset your Artswrk password. This link expires in " + b("1 hour") + "."),
    ctaText: "Reset Password",
    ctaUrl: resetUrl,
    footerNote: "If you didn\u2019t request this, you can safely ignore this email — your password won\u2019t change.<br><br>Or copy this link: <span style=\"word-break:break-all;color:#9ca3af;\">" + resetUrl + "</span>",
  });
  return sendSimpleEmail({ to, subject: "Reset your Artswrk password", html });
}

/**
 * A3 — Application confirmation. Doubles as the artist's own record of what
 * they sent: the rate they pitched and their message are included, so the email
 * answers "what did I actually say?" months later without opening the app.
 */
export async function sendApplicationConfirmationEmail({
  to, artistName, jobTitle, jobLocation, jobRate, jobUrl,
  jobDescription, pitchedRate, artistMessage,
}: {
  to: string; artistName: string; jobTitle: string;
  jobLocation?: string; jobRate?: string; jobUrl: string;
  jobDescription?: string; pitchedRate?: string; artistMessage?: string;
}): Promise<boolean> {
  const note = sanitizeUserText(artistMessage, 400);
  const html = renderEmailShell({
    accent: "artist",
    headline: "You applied! \u{1F389}",
    preheader: "Your application is with the hirer: " + jobTitle,
    bodyHtml:
      para("Hi " + b(artistName) + ",") +
      para("Your application has been submitted. The hirer will review it and reach out if there\u2019s a match. Good luck!") +
      detailsCard([
        { label: "Job", value: jobTitle },
        { label: "Location", value: jobLocation },
        { label: "Posted rate", value: jobRate },
        { label: "Details", value: sanitizeUserText(jobDescription, 400) },
      ]) +
      // The artist's own submission, so the email is a record and not a receipt.
      ((pitchedRate || note)
        ? para(b("What you sent")) +
          detailsCard([{ label: "Your rate", value: pitchedRate }]) +
          (note ? quote(note) : "")
        : ""),
    ctaText: "View Job",
    ctaUrl: jobUrl,
    footerNote: 'You\u2019ll hear from the hirer directly if they\u2019d like to move forward. In the meantime, keep exploring jobs on <a href="' + APP_URL + '/jobs" style="color:#ec008c;font-weight:600;">Artswrk</a>.',
  });
  // Subject leads with the job title — it is what the artist recognises in a
  // list of "You applied to:" emails.
  return sendSimpleEmail({ to, cc: SUPPORT_EMAIL, subject: "You applied to: " + jobTitle, html });
}
export async function sendNewApplicantAlertEmail({
  to, artistFirstName, artistLastInitial, jobTitle, jobLocation, jobRate, jobUrl, message, cc,
}: {
  to: string; artistFirstName: string; artistLastInitial?: string; jobTitle: string;
  jobLocation?: string; jobRate?: string; jobUrl: string;
  message?: string; cc?: string;
}): Promise<boolean> {
  // FirstName L. only \u2014 no email, no resume link. A client shouldn't be able
  // to identify or contact an applicant well enough to circumvent the
  // unlock/subscription paywall before actually unlocking or messaging them
  // through Artswrk. Matches sendProJobApplicantAlertEmail's pattern.
  const who = (artistFirstName + (artistLastInitial ? " " + artistLastInitial + "." : "")).trim();
  const note = sanitizeUserText(message, 500);
  const html = renderEmailShell({
    accent: "client",
    headline: who + " is available for your job!",
    preheader: who + " applied to " + jobTitle + ".",
    bodyHtml:
      para("Hi there, " + b(who) + " is interested in the job below.") +
      (note ? para("Message from " + b(who) + ":") + quote(note) : "") +
      detailsCard([
        { label: "Job", value: jobTitle },
        { label: "Location", value: jobLocation },
        { label: "Rate", value: jobRate },
      ]),
    ctaText: "View Submission",
    ctaUrl: jobUrl,
    footerNote: "Unlock or subscribe to view full profiles, resumes, and contact info from your dashboard.",
  });
  return sendSimpleEmail({ to, cc: cc ?? SUPPORT_EMAIL, subject: who + " is available for your job!", html });
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
/**
 * A1 — Artist welcome. Restyled onto the shared shell; copy preserved, with the
 * pricing paragraph corrected — PRO is $110/yr annual-only with a 7-day trial,
 * the $10.99/mo plan having been discontinued 2026-08-28.
 */
export async function sendArtistWelcomeEmail({
  to, firstName,
}: { to: string; firstName: string }): Promise<boolean> {
  const step = (icon: string, title: string, body: string) =>
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">' +
      '<tr><td style="background:#f9f9f9;border-radius:12px;padding:14px 16px;">' +
        '<div style="font-family:\'Poppins\',Arial,sans-serif;font-size:15px;font-weight:700;color:#111;margin-bottom:4px;">' +
          icon + ' ' + title +
        '</div>' +
        '<div style="font-family:\'Poppins\',Arial,sans-serif;font-size:14px;line-height:1.6;color:#52525b;">' +
          body +
        '</div>' +
      '</td></tr>' +
    '</table>';

  const html = renderEmailShell({
    accent: "artist",
    headline: "Welcome to Artswrk, " + firstName + "! \u{1F389}",
    preheader: "Here\u2019s how to get started.",
    bodyHtml:
      para("Thanks for joining Artswrk — we\u2019re so glad you\u2019re here.") +
      para("Artswrk was built " + b("for artists by artists") + ". Our mission is to shatter the starving artist stigma, and help you pay your bills with part-time work when you need it most.") +
      para(b("Here\u2019s how to get started:")) +
      step("\u{1F3A8}", "Create your profile",
           "Build a profile with your bio, services and skillsets. Share the link in your bio so hirers can see what you do best.") +
      step("\u{1F50D}", "Browse jobs",
           "Hundreds of jobs, from creative work to side jobs. Something new is posted every day.") +
      step("\u{1F4B3}", "Choose your plan",
           "Basic ($30/year) or PRO ($110/year \u2014 annual only, starting with a 7-day free trial). No commission on anything you earn, ever \u2014 discuss your rate freely with clients. The average Basic booking is $250; on PRO it\u2019s $500+. One booking pays the year off."),
    ctaText: "Go to My Dashboard",
    ctaUrl: APP_URL + "/app",
    footerNote: 'Questions? Email <a href="mailto:contact@artswrk.com" style="color:#ec008c;font-weight:600;">contact@artswrk.com</a> \u2014 we\u2019re happy to help, or to hear feedback.<br><br>Best,<br>Nick &amp; Rami<br>Co-Founders, Artswrk',
  });
  return sendSimpleEmail({ to, cc: SUPPORT_EMAIL, subject: "Welcome to Artswrk! \u{1F389}", html });
}
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
/** C2 — PRO job posted confirmation. Restyled onto the shell. */
export async function sendProJobPostedEmail(data: {
  to: string; firstName: string; company: string; serviceType: string;
  location: string | null; description: string | null;
  workFromAnywhere: boolean; jobLink: string;
}): Promise<boolean> {
  const html = renderEmailShell({
    accent: "client",
    headline: "Your job is live! \u{1F389}",
    preheader: "Artists can start applying now.",
    bodyHtml:
      para("Hey " + b(data.firstName) + ", your PRO job is posted and artists can start applying.") +
      detailsCard([
        { label: "Job", value: data.serviceType },
        { label: "Company", value: data.company },
        { label: "Location", value: data.workFromAnywhere ? "Work from anywhere" : data.location },
        { label: "Details", value: sanitizeUserText(data.description, 400) },
      ]),
    ctaText: "View Your Job",
    ctaUrl: data.jobLink,
    footerNote: "Artists can now apply. You can manage applicants and job details from your enterprise dashboard.",
  });
  return sendSimpleEmail({
    to: data.to, cc: SUPPORT_EMAIL,
    subject: "Your job has been posted — " + data.serviceType + " at " + data.company, html,
  });
}
/**
 * Internal ops alert — an artist successfully linked Stripe Connect for
 * payouts. Not artist- or client-facing; goes straight to SUPPORT_EMAIL so
 * the team has a record of who's actually payable, without having to check
 * the admin dashboard proactively.
 */
/**
 * Internal alert — a legacy Bubble user just set their password for the
 * first time (setInitialPassword) and logged in. Useful signal on its own
 * (99.9% of artists have no password yet, so this is the whole "claim your
 * account" moment) and doubles as an early-warning if that flow breaks for
 * someone — no confirmation email means nobody's actually getting through.
 */
export async function sendFirstLoginAlertEmail({
  name, email, userRole, userId,
}: { name: string; email: string; userRole?: string | null; userId: number }): Promise<boolean> {
  const html = renderEmailShell({
    accent: "internal",
    headline: "First login — password just set 🔑",
    preheader: name + " (" + (userRole ?? "unknown role") + ") set their password and logged in.",
    bodyHtml:
      para(b(name) + " just set a password for the first time and logged in — this was a legacy Bubble account with no password on file.") +
      detailsCard([
        { label: "Name", value: name },
        { label: "Email", value: email },
        { label: "Role", value: userRole ?? "unknown" },
        { label: "User ID", value: String(userId) },
      ]),
    ctaText: "View in Admin",
    ctaUrl: APP_URL + "/admin-dashboard",
  });
  return sendSimpleEmail({ to: SUPPORT_EMAIL, subject: name + " just logged in for the first time", html });
}

export async function sendStripeConnectAlertEmail({
  artistName, artistEmail, accountId,
}: { artistName: string; artistEmail?: string | null; accountId: string }): Promise<boolean> {
  const html = renderEmailShell({
    accent: "internal",
    headline: "Stripe Connect linked ✅",
    preheader: artistName + " connected their Stripe payout account.",
    bodyHtml:
      para(b(artistName) + " just finished connecting their Stripe account for payouts.") +
      detailsCard([
        { label: "Artist", value: artistName },
        { label: "Email", value: artistEmail },
        { label: "Stripe account", value: accountId },
      ]),
    ctaText: "View in Admin",
    ctaUrl: APP_URL + "/admin-dashboard",
  });
  return sendSimpleEmail({ to: SUPPORT_EMAIL, subject: artistName + " connected Stripe for payouts", html });
}
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
  return sendSimpleEmail({ to, cc: cc ?? SUPPORT_EMAIL, subject: senderName + " just sent you a message!", html });
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
/**
 * A4 — PRO submission confirmation. Same shape as A3 (the basic application
 * confirmation): the artist's own message, pitched rate and resume link come
 * back to them, so the email is a record of what they actually submitted.
 *
 * Safe to include here where it is not in the applicant ALERT: this goes to the
 * artist about their own application, not to a client who hasn't unlocked it.
 */
export async function sendProJobSubmissionConfirmationEmail(data: {
  to: string; artistFirstName: string; serviceType: string;
  location: string; description: string | null; dashboardLink: string;
  pitchedRate?: string; artistMessage?: string; resumeLink?: string;
}): Promise<boolean> {
  const note = sanitizeUserText(data.artistMessage, 400);
  const html = renderEmailShell({
    accent: "artist",
    headline: "Your submission has been received!",
    preheader: "It\u2019s with the client now: " + data.serviceType,
    bodyHtml:
      para("Hi " + b(data.artistFirstName) + ",") +
      para("Your submission to the job below has been sent to the client. Once they confirm you or ask for more information, you\u2019ll get a notification.") +
      detailsCard([
        { label: "Job", value: data.serviceType },
        { label: "Location", value: data.location },
        { label: "Details", value: sanitizeUserText(data.description, 400) },
      ]) +
      ((data.pitchedRate || note || data.resumeLink)
        ? para(b("What you sent")) +
          detailsCard([
            { label: "Your rate", value: data.pitchedRate },
            { label: "Resume", value: data.resumeLink ? "Attached" : undefined },
          ]) +
          (note ? quote(note) : "")
        : ""),
    ctaText: "View My Submissions",
    ctaUrl: data.dashboardLink,
    footerNote: "You can always check on your submissions from your artist dashboard.<br>Best,<br>The Artswrk Team",
  });
  return sendSimpleEmail({ to: data.to, cc: SUPPORT_EMAIL, subject: "Your submission has been received!", html });
}
export async function sendArtistBookingConfirmedEmail(data: {
  to: string; artistName: string; artistType?: string; clientName: string;
  date: string; details?: string; location: string; rate: string;
  serviceType: string; transportDetails?: string; transportReimbursed?: string;
  bookingUrl: string; paymentMethod?: string | null;
}): Promise<boolean> {
  const payLabel = data.paymentMethod === "direct" ? "Paid directly by the studio" : "Paid via Artswrk";
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
        { label: "Payment", value: payLabel },
        { label: "Transportation", value: data.transportReimbursed ? (data.transportDetails || "Reimbursed") : data.transportDetails },
        { label: "Details", value: sanitizeUserText(data.details, 400) },
      ]),
    ctaText: "View Booking",
    ctaUrl: data.bookingUrl,
    footerNote: "If anything looks off, message the client on Artswrk or email us.",
  });
  return sendSimpleEmail({ to: data.to, cc: SUPPORT_EMAIL, subject: "You\u2019re confirmed for " + data.serviceType + "!", html });
}
/** C5 — Booking confirmed, client. Inline; replaces CLIENT_BOOKING_CONFIRMED. */
export async function sendClientBookingConfirmedEmail(data: {
  to: string; artistName: string; artistType?: string; clientName?: string;
  date: string; details?: string; location: string; rate: string;
  serviceType: string; transportDetails?: string; transportReimbursed?: string;
  bookingUrl: string; paymentMethod?: string | null;
}): Promise<boolean> {
  const payLabel = data.paymentMethod === "direct" ? "You\u2019ll pay this artist directly" : "Paid via Artswrk";
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
        { label: "Payment", value: payLabel },
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
      para("Hi " + b(data.clientName || "there") + ", " + b(data.artistName) + "\u2019s booking is complete and ready for your review.") +
      detailsCard([
        { label: "Date", value: data.date || data.startDate },
        { label: "Rate", value: data.clientRate },
        { label: "Reimbursements", value: data.reimbursements },
        { label: "Total due", value: total },
      ]) +
      para("If the hours need adjusting, you can update them before paying. Once you approve, pay in a minute by card or Apple Pay \u2014 you\u2019ll get a receipt as soon as it processes."),
    ctaText: "Review & Pay",
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
  return sendSimpleEmail({ to, cc: SUPPORT_EMAIL, subject: "Welcome to Artswrk PRO \u{1F48E}", html });
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
  return sendSimpleEmail({ to, cc: SUPPORT_EMAIL, subject: "Your payment is on its way! \u{1F4B8}", html });
}

/**
 * Artist payment-received notification. Shared by both the regular booking
 * invoice path and the admin booking-period path (checkoutEffects.ts) —
 * previously each had its own hand-copied inline HTML block that didn't
 * match the renderEmailShell/detailsCard house style everything else uses.
 */
export async function sendArtistPaymentReceivedEmail({
  to, firstName, bookingLabel, amount,
}: {
  to: string; firstName: string; bookingLabel: string; amount: string;
}): Promise<boolean> {
  const total = `$${String(amount).replace(/^\$/, "")}`;
  const html = renderEmailShell({
    accent: "artist",
    headline: "Your payment has been received!",
    preheader: `You were just paid ${total} for ${bookingLabel}.`,
    bodyHtml:
      para("Hi " + b(firstName) + ",") +
      para("Great news — the studio has paid your invoice for " + b(bookingLabel) + ".") +
      detailsCard([
        { label: "Amount", value: total },
        { label: "Booking", value: bookingLabel },
      ]),
    ctaText: "View My Wallet",
    ctaUrl: `${APP_URL}/app/payments`,
    footerNote: "Best,<br>The Artswrk Team",
  });
  return sendSimpleEmail({ to, cc: SUPPORT_EMAIL, subject: `Payment Received — ${bookingLabel}`, html });
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
 * "Complete your booking" reminder — artswrk-pay path. Old Bubble copy,
 * kept close to verbatim per Ramita's request 2026-08-31. Fires from a
 * scheduled sweep (server/bookingReminders.ts), not on demand.
 */
export async function sendCompleteBookingReminderEmail({
  to, firstName, bookingUrl,
}: {
  to: string; firstName: string; bookingUrl: string;
}): Promise<boolean> {
  const html = renderEmailShell({
    accent: "artist",
    headline: "Complete Your Booking",
    preheader: "Verify your hours and mark your booking complete to get paid.",
    bodyHtml:
      para("Hello " + b(firstName) + ",") +
      para("We hope your Artswrk booking went well today. To get paid, please log in to verify total hours, upload any reimbursements, and mark your booking as “complete.”") +
      para("If you haven’t connected to Stripe yet, you will be prompted to do so before you’re able to complete your booking."),
    ctaText: "Complete Booking",
    ctaUrl: bookingUrl,
    footerNote: "Best,<br>The Artswrk Team",
  });
  return sendSimpleEmail({ to, cc: SUPPORT_EMAIL, subject: "Artswrk: Complete Your Booking", html });
}

/**
 * "Did you get paid?" reminder — direct-pay path. Same trigger and timing
 * as the Artswrk-pay reminder above, different content since there's no
 * invoice to submit here — just self-attesting the studio already paid.
 */
export async function sendConfirmDirectPaymentReminderEmail({
  to, firstName, bookingUrl,
}: {
  to: string; firstName: string; bookingUrl: string;
}): Promise<boolean> {
  const html = renderEmailShell({
    accent: "artist",
    headline: "Complete Your Booking",
    preheader: "Confirm you were paid directly for this booking.",
    bodyHtml:
      para("Hello " + b(firstName) + ",") +
      para("We hope your Artswrk booking went well today. This one's set up as a direct payment from the studio — once you've received it, please log in and confirm you were paid so we can close out the booking."),
    ctaText: "Confirm Payment",
    ctaUrl: bookingUrl,
    footerNote: "Haven’t been paid yet? No action needed — just confirm once it comes through.<br><br>Best,<br>The Artswrk Team",
  });
  return sendSimpleEmail({ to, cc: SUPPORT_EMAIL, subject: "Artswrk: Complete Your Booking", html });
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
