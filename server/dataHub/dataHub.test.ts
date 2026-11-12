import { describe, it, expect } from "vitest";
import { computeEngagement } from "./engagement";
import { parseDataHubCsv, scopeBlocksEmail } from "./importCsv";
import { buildHubspotProps, roleFor } from "./hubspotSync";

describe("computeEngagement", () => {
  const now = new Date("2026-11-12T12:00:00Z");
  it("counts distinct campaigns opened in 90 days and WRK opens", () => {
    const e = computeEngagement(
      {
        opened: [
          { campaignId: 809, count: 3, eventTime: "2026-11-05T10:00:00Z" },
          { campaignId: 809, count: 1, eventTime: "2026-11-06T10:00:00Z" },
          { campaignId: 700, count: 1, eventTime: "2026-10-01T10:00:00Z" },
          { campaignId: 512, count: 1, eventTime: "2026-03-01T10:00:00Z" },
        ],
      },
      new Set([512, 809]),
      now
    );
    expect(e.opens90d).toBe(2);
    expect(e.wrkEmailsOpened).toBe(2);
    expect(e.lastOpenedAt?.toISOString()).toBe("2026-11-06T10:00:00.000Z");
  });
  it("handles a contact with no opens", () => {
    expect(computeEngagement({}, new Set(), now)).toEqual({ lastOpenedAt: null, opens90d: 0, wrkEmailsOpened: 0 });
  });
});

describe("DNC scope", () => {
  it("keeps M&A-only contacts emailable", () => {
    expect(scopeBlocksEmail("M&A only")).toBe(false);
    expect(scopeBlocksEmail("Full DNC")).toBe(true);
    expect(scopeBlocksEmail("Full DNC - old email only; studio remains contactable")).toBe(true);
    expect(scopeBlocksEmail("Bad email only")).toBe(true);
    expect(scopeBlocksEmail("")).toBe(false);
  });
});

describe("parseDataHubCsv", () => {
  it("finds the header below title rows and reads Row ID + DNC", () => {
    const csv = [
      "MASTER LIST,,,",
      ",,,",
      "DO NOT CONTACT,Row ID,Studio Name,Email",
      ",1,Studio A,a@studio-a.test",
      "Do Not Contact,2,Studio B,B@Studio-B.test",
      ",3,Studio B dup,b@studio-b.test",
      ",4,No email,",
    ].join("\n");
    const rows = parseDataHubCsv(csv, "master_list");
    expect(rows).toHaveLength(2);
    const b = rows.find((r) => r.email === "b@studio-b.test")!;
    expect(b.doNotContact).toBe(true);
    expect(b.masterRowId).toBe("2");
    expect(rows.find((r) => r.email === "a@studio-a.test")!.doNotContact).toBe(false);
  });
  it("reads scope from the DNC Log", () => {
    const csv = [
      "Date flagged,Studio/Person,Email,Source,Scope (Full DNC / M&A only),Notes",
      "2026-10-08,Studio C,c@studio-c.test,email,M&A only,",
      "2026-10-09,Studio D,d@studio-d.test,email,Full DNC,",
    ].join("\n");
    const rows = parseDataHubCsv(csv, "dnc_log");
    expect(rows.find((r) => r.email === "c@studio-c.test")!.doNotContact).toBe(false);
    expect(rows.find((r) => r.email === "d@studio-d.test")!.doNotContact).toBe(true);
  });
});

describe("HubSpot mapping", () => {
  it("maps roles", () => {
    expect(roleFor("Client", true)).toBe("enterprise");
    expect(roleFor("Client", false)).toBe("client");
    expect(roleFor("Artist", false)).toBe("artist");
    expect(roleFor(null, false)).toBeNull();
  });
  it("never blanks optional fields", () => {
    const p = buildHubspotProps({ email: "x@y.test", opens90d: 2, doNotContact: true }, new Date("2026-11-12T00:00:00Z"));
    expect(p.artswrk_do_not_contact).toBe("true");
    expect(p.artswrk_brevo_opens_90d).toBe("2");
    expect(p).not.toHaveProperty("artswrk_master_row_id");
    expect(p).not.toHaveProperty("artswrk_role");
    expect(p).not.toHaveProperty("artswrk_brevo_last_open");
  });
});
