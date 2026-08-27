import { describe, expect, it } from "vitest";
import {
  bookingHours,
  bookingList,
  bookingNumber,
  bookingSourceText,
  parseBookingLocation,
} from "../scripts/sync-bookings-once";

describe("booking reconciliation helpers", () => {
  it("normalizes booking financial values and preserves decimal hours", () => {
    expect(bookingNumber("42.6")).toBe(42.6);
    expect(bookingNumber("bad")).toBeNull();
    expect(bookingHours("2.75")).toBe(2.75);
  });

  it("preserves source relationship lists and legacy values", () => {
    expect(bookingList(["p1", "p2"])).toBe('["p1","p2"]');
    expect(bookingList([])).toBeNull();
    expect(bookingSourceText({ id: "invoice-1" })).toBe('{"id":"invoice-1"}');
  });

  it("parses Bubble booking locations", () => {
    expect(parseBookingLocation({ address: "Austin, TX", lat: 30.27, lng: -97.74 })).toEqual({
      address: "Austin, TX",
      lat: "30.27",
      lng: "-97.74",
    });
  });
});
