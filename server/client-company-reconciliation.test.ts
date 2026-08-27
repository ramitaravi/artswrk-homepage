import { describe, expect, it } from "vitest";
import {
  companyClientIds,
  companyLocation,
  companyLogo,
} from "../scripts/sync-client-companies-once";

describe("client-company reconciliation helpers", () => {
  it("preserves the exact ordered Bubble Client relationship", () => {
    expect(companyClientIds(["u1", "u2"])).toEqual(["u1", "u2"]);
    expect(companyClientIds("u1")).toEqual(["u1"]);
    expect(companyClientIds(null)).toEqual([]);
  });

  it("parses Bubble company locations", () => {
    expect(companyLocation({ address: "Chicago, IL", lat: 41.88, lng: -87.63 })).toEqual({
      address: "Chicago, IL",
      lat: "41.88",
      lng: "-87.63",
    });
  });

  it("normalizes protocol-relative logos", () => {
    expect(companyLogo("//cdn.example.com/logo.png")).toBe("https://cdn.example.com/logo.png");
    expect(companyLogo(null)).toBeNull();
  });
});
