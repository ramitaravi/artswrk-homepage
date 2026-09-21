/**
 * Where a PRO job's "Apply Now" goes, when it leaves Artswrk at all.
 *
 * Returns an off-site target (the employer's link, or a mailto) or null, in
 * which case artists apply on Artswrk and land in the employer's dashboard.
 *
 * - Enterprise accounts always take applications on Artswrk — that's what
 *   they pay for, and their applicants must reach their dashboard. The
 *   stored link/email is kept, just never used.
 * - Everyone else (mostly jobs migrated from Bubble): a real link or a real
 *   employer email means off-site. The applyDirect flag is unreliable on those
 *   records — many real link-out jobs have applyDirect=0 with the link set —
 *   so the presence of a real target is the signal. @artswrk.com aliases and
 *   junk strings stored in applyEmail are not real targets.
 */
export function externalApplyTarget(job: {
  applyLink?: string | null;
  applyEmail?: string | null;
  ownerIsEnterprise?: boolean | null;
}): string | null {
  if (job.ownerIsEnterprise) return null;
  if (job.applyLink) return job.applyLink;
  const email = job.applyEmail?.trim() ?? "";
  const isRealEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.toLowerCase().endsWith("@artswrk.com");
  return isRealEmail ? `mailto:${email}` : null;
}

/**
 * An enterprise job's own application form, supplied only by an authenticated
 * post-application response. The raw job detail never contains this secret,
 * so it cannot be opened before the Artswrk application is recorded.
 */
export function followUpApplyLink(application: { followUpApplyLink?: string | null } | null | undefined): string | null {
  return application?.followUpApplyLink ?? null;
}
