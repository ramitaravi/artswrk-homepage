/**
 * Is this a company (enterprise) account?
 *
 * planTier is the source of truth ("enterprise_subscription" /
 * "enterprise_on_demand"); the older `enterprise` flag covers accounts from
 * before planTier existed. Shared so the server and the PRO job page agree.
 */
export function isEnterpriseAccount(
  user: { planTier?: string | null; enterprise?: boolean | number | null } | null | undefined,
): boolean {
  if (!user) return false;
  return (user.planTier ?? "").startsWith("enterprise") || user.enterprise === true || user.enterprise === 1;
}

/** Only the job owner (or an Artswrk admin) may inspect its applicants. */
export function canAccessEnterpriseJobApplicants(input: {
  viewerUserId: number;
  ownerUserId?: number | null;
  isAdmin: boolean;
}): boolean {
  return input.isAdmin || (input.ownerUserId != null && input.ownerUserId === input.viewerUserId);
}

/**
 * Application targets are paid PRO content. A non-PRO viewer never receives
 * them, and an enterprise owner's own form is never returned with the public
 * job detail because it is revealed only after an Artswrk application exists.
 */
export function visibleProJobApplyFields(
  job: { applyLink?: string | null; applyEmail?: string | null; applyDirect?: boolean | null },
  input: { viewerIsPro: boolean; ownerIsEnterprise: boolean },
): { applyLink: string | null; applyEmail: string | null; applyDirect: boolean } {
  if (!input.viewerIsPro || input.ownerIsEnterprise) {
    return { applyLink: null, applyEmail: null, applyDirect: false };
  }
  return {
    applyLink: job.applyLink ?? null,
    applyEmail: job.applyEmail ?? null,
    applyDirect: job.applyDirect === true,
  };
}

/** An enterprise form is disclosed only in an authenticated application response. */
export function enterpriseFollowUpApplyLink(
  job: { applyLink?: string | null },
  owner: { planTier?: string | null; enterprise?: boolean | number | null } | null | undefined,
): string | null {
  const link = job.applyLink?.trim();
  return isEnterpriseAccount(owner) && link ? link : null;
}
