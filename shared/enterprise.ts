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
