/**
 * Which sidebar nav item counts as "the page you're on".
 *
 * Split out of DashboardLayout because it's the one part of the sidebar with
 * real logic and it got it wrong twice: "My Artists" never highlighted at all,
 * and "Browse Artists" highlighted on both tabs.
 *
 * The cause was `location.startsWith(item.href)` against a router location
 * that carries no query string — so "/app/artists?tab=my" could never match
 * anything, and "/app/artists" matched whichever tab you were on. Path and
 * query have to be compared separately.
 */
export function isNavItemActive(href: string, location: string, search: string): boolean {
  const [path, query] = href.split("?");

  // startsWith(path + "/") rather than startsWith(path): otherwise /app/jobs
  // would light up for a sibling route like /app/jobseekers.
  const pathMatches = path === "/app"
    ? location === "/app"
    : location === path || location.startsWith(path + "/");
  if (!pathMatches) return false;

  if (query) return search.includes(query);

  // A plain item (/app/artists) shouldn't light up while a tabbed sibling
  // (/app/artists?tab=my) is the one selected.
  return !search.includes("tab=");
}
