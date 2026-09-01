/**
 * A landing-page inquiry that belongs to someone who already has an account.
 *
 * They typed a job description into a marketing page, so sending them through
 * login and dropping them on an empty dashboard would lose it. The draft is
 * parked here, survives the login round-trip, and is read once by the
 * enterprise post-job modal.
 *
 * sessionStorage, not localStorage: it should not outlive the tab or resurface
 * days later on a different visit.
 */
export const INQUIRY_DRAFT_KEY = "artswrk-inquiry-draft";

export type InquiryDraft = {
  company?: string;
  description?: string;
};

export function saveInquiryDraft(draft: InquiryDraft): void {
  try {
    sessionStorage.setItem(INQUIRY_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Private browsing / storage blocked — the job just isn't prefilled.
  }
}
