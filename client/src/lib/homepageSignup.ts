export const HOMEPAGE_JOB_DRAFT_KEY = "postJobPrefill";

export type HomepageSignupRole = "client" | "artist";

export function buildHomepageAuthDestination({
  email,
  role,
  exists,
}: {
  email: string;
  role: HomepageSignupRole;
  exists: boolean;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const next = role === "client" ? "/post-job" : "/app";
  const params = new URLSearchParams({
    email: normalizedEmail,
    role,
    next,
  });

  return `${exists ? "/login" : "/join"}?${params.toString()}`;
}
