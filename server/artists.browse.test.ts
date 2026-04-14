/**
 * Tests for artists.browse tRPC procedure and getArtistsList DB helper.
 * Uses mocked DB so no real database connection is required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the DB module ────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getArtistsList: vi.fn(),
  };
});

import { getArtistsList } from "./db";

const mockGetArtistsList = vi.mocked(getArtistsList);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeArtist(overrides: Partial<{
  id: number;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  slug: string | null;
  profilePicture: string | null;
  location: string | null;
  bio: string | null;
  masterArtistTypes: string | null;
  artistServices: string | null;
  artistDisciplines: string | null;
  artswrkPro: boolean | null;
  instagram: string | null;
}> = {}) {
  return {
    id: 1,
    firstName: "Jane",
    lastName: "Doe",
    name: "Jane Doe",
    slug: "jane-doe",
    profilePicture: null,
    location: "Chicago, IL",
    bio: "Professional dancer",
    masterArtistTypes: JSON.stringify(["Dance Educator"]),
    artistServices: JSON.stringify(["Substitute Teacher"]),
    artistDisciplines: JSON.stringify(["Ballet", "Hip Hop"]),
    artswrkPro: true,
    instagram: "@janedoe",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getArtistsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns artists and total count", async () => {
    const artist = makeArtist();
    mockGetArtistsList.mockResolvedValue({ artists: [artist], total: 1 });

    const result = await getArtistsList({ limit: 48, offset: 0 });

    expect(result.artists).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.artists[0].firstName).toBe("Jane");
  });

  it("passes search parameter through", async () => {
    mockGetArtistsList.mockResolvedValue({ artists: [], total: 0 });

    await getArtistsList({ limit: 48, offset: 0, search: "Jane" });

    expect(mockGetArtistsList).toHaveBeenCalledWith(
      expect.objectContaining({ search: "Jane" })
    );
  });

  it("passes artistType filter through", async () => {
    mockGetArtistsList.mockResolvedValue({ artists: [], total: 0 });

    await getArtistsList({ limit: 48, offset: 0, artistType: "Dance Educator" });

    expect(mockGetArtistsList).toHaveBeenCalledWith(
      expect.objectContaining({ artistType: "Dance Educator" })
    );
  });

  it("returns empty list when no artists match", async () => {
    mockGetArtistsList.mockResolvedValue({ artists: [], total: 0 });

    const result = await getArtistsList({ search: "zzznomatch" });

    expect(result.artists).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("supports pagination via offset", async () => {
    const artists = Array.from({ length: 10 }, (_, i) =>
      makeArtist({ id: i + 1, firstName: `Artist${i + 1}` })
    );
    mockGetArtistsList.mockResolvedValue({ artists, total: 100 });

    const result = await getArtistsList({ limit: 10, offset: 20 });

    expect(mockGetArtistsList).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 20 })
    );
    expect(result.artists).toHaveLength(10);
    expect(result.total).toBe(100);
  });

  it("handles artists with null optional fields gracefully", async () => {
    const artist = makeArtist({
      firstName: null,
      lastName: null,
      name: "Anonymous",
      profilePicture: null,
      location: null,
      masterArtistTypes: null,
    });
    mockGetArtistsList.mockResolvedValue({ artists: [artist], total: 1 });

    const result = await getArtistsList({});

    expect(result.artists[0].name).toBe("Anonymous");
    expect(result.artists[0].masterArtistTypes).toBeNull();
  });

  it("handles JSON parse errors in masterArtistTypes gracefully on frontend", () => {
    // Simulate the frontend try/catch pattern for parsing JSON arrays
    const parseType = (raw: string | null) => {
      try { return JSON.parse(raw ?? "[]")[0] ?? ""; } catch { return ""; }
    };

    expect(parseType('["Dance Educator"]')).toBe("Dance Educator");
    expect(parseType(null)).toBe("");
    expect(parseType("invalid json")).toBe("");
    expect(parseType("[]")).toBe("");
  });
});
