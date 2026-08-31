/**
 * Tests for the sidebar highlight rule (shared/nav.ts).
 *
 * Both failures below were live: "My Artists" never highlighted, because its
 * href carries ?tab=my and the router's location does not; and "Browse
 * Artists" highlighted on both tabs, because it is a prefix of the other.
 */
import { describe, it, expect } from "vitest";
import { isNavItemActive } from "../shared/nav";

describe("isNavItemActive", () => {
  it("highlights a tabbed item when its query is the selected one", () => {
    expect(isNavItemActive("/app/artists?tab=my", "/app/artists", "?tab=my")).toBe(true);
  });

  it("does not highlight the plain item while its tabbed sibling is selected", () => {
    expect(isNavItemActive("/app/artists", "/app/artists", "?tab=my")).toBe(false);
  });

  it("highlights the plain item on the bare path, and not its tabbed sibling", () => {
    expect(isNavItemActive("/app/artists", "/app/artists", "")).toBe(true);
    expect(isNavItemActive("/app/artists?tab=my", "/app/artists", "")).toBe(false);
  });

  it("keeps the section lit on a detail page beneath it", () => {
    expect(isNavItemActive("/app/artists", "/app/artists/1234", "")).toBe(true);
  });

  it("does not let a path prefix match a different section", () => {
    expect(isNavItemActive("/app/jobs", "/app/jobseekers", "")).toBe(false);
  });

  it("matches Dashboard only on the exact root", () => {
    expect(isNavItemActive("/app", "/app", "")).toBe(true);
    expect(isNavItemActive("/app", "/app/jobs", "")).toBe(false);
  });
});
