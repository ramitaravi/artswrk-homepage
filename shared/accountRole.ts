export type AccountRoleUser = {
  userRole?: "Artist" | "Client" | string | null;
  planTier?: string | null;
};

/**
 * Account identity and paid entitlement are separate concerns:
 * - userRole decides whether the account is an Artist or Client.
 * - planTier decides what that account can access.
 *
 * A planTier prefix is only a fallback for legacy rows whose userRole is null.
 */
export function isArtistAccount(user: AccountRoleUser | null | undefined): boolean {
  if (!user) return false;
  if (user.userRole === "Artist") return true;
  if (user.userRole === "Client") return false;
  return user.planTier?.startsWith("artist_") ?? false;
}

export function isClientAccount(user: AccountRoleUser | null | undefined): boolean {
  if (!user) return false;
  if (user.userRole === "Client") return true;
  if (user.userRole === "Artist") return false;
  return !!user.planTier && !user.planTier.startsWith("artist_");
}

export function planTierMatchesUserRole(user: AccountRoleUser | null | undefined): boolean {
  if (!user?.userRole || !user.planTier) return true;
  return user.userRole === "Artist"
    ? user.planTier.startsWith("artist_")
    : !user.planTier.startsWith("artist_");
}
