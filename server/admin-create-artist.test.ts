/**
 * Creating an artist from the admin form.
 *
 * The regression this pins: drizzle's mysql2 driver resolves insert() to
 * [ResultSetHeader, fields], so the new id is at result[0].insertId. Reading
 * result.insertId returned undefined, and because nothing checked it the
 * failure spread out in three directions at once -- the account was created,
 * but the response carried no id (the admin saw "Artist not found"), the
 * welcome email died inside its own catch on
 * "DELETE FROM password_reset_tokens WHERE userId = undefined", and the
 * emailSent flag stayed null, which the UI reads as "no email was requested"
 * rather than "the send failed".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const emailMocks = vi.hoisted(() => ({ simple: vi.fn(), welcome: vi.fn() }));
const dbMocks = vi.hoisted(() => ({
  insertValues: vi.fn(),
  resetToken: vi.fn(),
}));

const NEW_ID = 90210;

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByOpenId: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserById: vi.fn(),
    createPasswordResetToken: dbMocks.resetToken,
    addArtistAffiliation: vi.fn(),
    findOrCreateAffiliation: vi.fn(),
    resolveMasterArtistTypeIds: vi.fn(async () => [1]),
    resolveMasterServiceTypeIds: vi.fn(async () => []),
    resolveMasterStyleTypeIds: vi.fn(async () => []),
    normalizeSocialLink: (v: string) => v,
    // The shape the real driver returns: [ResultSetHeader, fields].
    getDb: vi.fn(async () => ({
      insert: () => ({ values: dbMocks.insertValues }),
    })),
  };
});
vi.mock("./email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./email")>();
  return { ...actual, sendSimpleEmail: emailMocks.simple, sendArtistWelcomeEmail: emailMocks.welcome };
});

import { appRouter } from "./routers";
import * as db from "./db";

const ADMIN = { id: 1, openId: "admin-open", role: "admin" };
const context = {
  user: { openId: ADMIN.openId, role: "admin", id: ADMIN.id },
  req: { protocol: "https", headers: {} },
  res: {},
} as unknown as TrpcContext;
const caller = () => appRouter.createCaller(context);

const INPUT = {
  email: "new.artist@example.test",
  firstName: "Ada",
  lastName: "Lovelace",
  location: "Brooklyn, NY, USA",
  place: { formatted: "Brooklyn, NY, USA", lat: 40.6782, lng: -73.9442, city: "Brooklyn", state: "New York", country: "United States", placeId: "ChIJ_test" },
  masterArtistTypes: ["Dancer"],
  sendWelcomeEmail: true,
  welcomeEmailSubject: "Welcome to Artswrk!",
  welcomeEmailHtml: "<p>Hey Ada,</p>",
  origin: "https://artswrk.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getUserByOpenId).mockResolvedValue(ADMIN as any);
  vi.mocked(db.getUserByEmail).mockResolvedValue(undefined as any);
  vi.mocked(db.getUserById).mockImplementation(async (id: number) =>
    (id === NEW_ID ? { id: NEW_ID, email: INPUT.email, firstName: "Ada" } : undefined) as any);
  dbMocks.insertValues.mockResolvedValue([{ insertId: NEW_ID }, []]);
  dbMocks.resetToken.mockResolvedValue(undefined);
  emailMocks.simple.mockResolvedValue(true);
});

describe("admin.createArtist", () => {
  it("reads the new id out of the driver's [header, fields] result", async () => {
    const created: any = await caller().admin.createArtist(INPUT as any);
    expect(created.id).toBe(NEW_ID);
    // The reset token is keyed to a real id, not undefined.
    expect(dbMocks.resetToken).toHaveBeenCalledWith(NEW_ID, expect.any(String), expect.any(Date));
  });

  it("saves the whole place, not just its label", async () => {
    await caller().admin.createArtist(INPUT as any);
    expect(dbMocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      location: "Brooklyn, NY, USA",
      locationLat: "40.6782",
      locationLng: "-73.9442",
      locationCity: "Brooklyn",
      locationState: "New York",
      locationPlaceId: "ChIJ_test",
    }));
  });

  it("marks the account admin-added, and NOT yet onboarded", async () => {
    await caller().admin.createArtist(INPUT as any);
    expect(dbMocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      addedByAdmin: true,
      source: "Admin",
      // An admin filled in what they could; the artist still answers
      // onboarding. userSignedUp/step 4 said "already done" and was why an
      // invited artist never saw onboarding at all.
      userSignedUp: false,
      onboardingStep: 1,
    }));
  });

  it("copies support on the admin's own composed invite", async () => {
    const created: any = await caller().admin.createArtist(INPUT as any);
    expect(emailMocks.simple).toHaveBeenCalledWith(expect.objectContaining({
      to: INPUT.email,
      cc: "support@artswrk.com",
      subject: "Welcome to Artswrk!",
    }));
    expect(created.emailSent).toBe(true);
  });

  it("reports a failed send as false, never as 'none requested'", async () => {
    dbMocks.resetToken.mockRejectedValue(new Error("token insert blew up"));
    const created: any = await caller().admin.createArtist(INPUT as any);
    expect(created.emailSent).toBe(false);   // null would read as "not requested"
    expect(created.id).toBe(NEW_ID);          // and the account still exists
  });

  it("refuses an artist with no type", async () => {
    await expect(caller().admin.createArtist({ ...INPUT, masterArtistTypes: [] } as any))
      .rejects.toThrow();
  });

  it("refuses an artist with no location", async () => {
    await expect(caller().admin.createArtist({ ...INPUT, location: "" } as any))
      .rejects.toThrow();
  });
});

/**
 * The sign-in screen branches on these, so they have to survive the trip.
 * `lookupEmail` returned addedByAdmin correctly while InlineAuth hand-copied
 * four fields out of the response and dropped it — the account was right, the
 * greeting was wrong, and nothing in between complained.
 */
describe("what the sign-in screen is told about an account", () => {
  it("reports an admin-added artist as such, and as not yet onboarded", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: NEW_ID, email: INPUT.email, firstName: "Ada", name: "Ada Lovelace",
      userRole: "Artist", passwordHash: null, addedByAdmin: true, userSignedUp: false,
      profilePicture: null, clientCompanyName: null,
    } as any);

    const res: any = await appRouter.createCaller({
      user: null, req: { protocol: "https", headers: {} }, res: {},
    } as any).auth.lookupEmail({ email: INPUT.email });

    expect(res.exists).toBe(true);
    expect(res.hasPassword).toBe(false);   // -> the create-password branch
    expect(res.addedByAdmin).toBe(true);   // -> "Welcome to Artswrk", not "welcome back"
    expect(res.needsOnboarding).toBe(true);// -> onboarding, not the dashboard
  });

  it("reports a migrated account as neither", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 500, email: "old@example.test", firstName: "Sam", name: "Sam",
      userRole: "Artist", passwordHash: null, addedByAdmin: false, userSignedUp: true,
      profilePicture: null, clientCompanyName: null,
    } as any);

    const res: any = await appRouter.createCaller({
      user: null, req: { protocol: "https", headers: {} }, res: {},
    } as any).auth.lookupEmail({ email: "old@example.test" });

    expect(res.addedByAdmin).toBe(false);
    expect(res.needsOnboarding).toBe(false);
  });
});
