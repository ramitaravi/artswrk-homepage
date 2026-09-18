import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertReimbursementWriteAccess } from "./reimbursementAccess";

const root = path.resolve(import.meta.dirname, "..");

describe("reimbursement write access", () => {
  const booking = {
    id: 10,
    artistUserId: 42,
    paymentMethod: "artswrk",
    isAdminBooking: true,
    isRecurring: true,
  };

  it("allows the booked artist to attach an expense to that booking's week", () => {
    expect(() => assertReimbursementWriteAccess({
      userId: 42,
      booking,
      bookingPeriodId: 7,
      period: { bookingId: 10 },
    })).not.toThrow();
  });

  it("rejects another artist and a period from another booking", () => {
    expect(() => assertReimbursementWriteAccess({
      userId: 99,
      booking,
      bookingPeriodId: 7,
      period: { bookingId: 10 },
    })).toThrow("Not authorized");
    expect(() => assertReimbursementWriteAccess({
      userId: 42,
      booking,
      bookingPeriodId: 7,
      period: { bookingId: 11 },
    })).toThrow("does not belong");
  });

  it("requires a week for recurring bookings and rejects direct-pay expenses", () => {
    expect(() => assertReimbursementWriteAccess({ userId: 42, booking })).toThrow("Choose the week");
    expect(() => assertReimbursementWriteAccess({
      userId: 42,
      booking: { ...booking, isRecurring: false, paymentMethod: "direct" },
    })).toThrow("paid through Artswrk");
  });
});

describe("booking release integration wiring", () => {
  const dbSource = readFileSync(path.join(root, "server/db.ts"), "utf8");
  const routerSource = readFileSync(path.join(root, "server/routers.ts"), "utf8");
  const artistSource = readFileSync(path.join(root, "client/src/pages/ArtistDashboard.tsx"), "utf8");
  const bookingsSource = readFileSync(path.join(root, "client/src/pages/dashboard/Bookings.tsx"), "utf8");

  it("persists explicit rate basis fields when bookings are created", () => {
    expect(dbSource).toContain("rateType: data.rateType ?? null");
    expect(dbSource).toContain("hourlyRate: data.hourlyRate ?? null");
    expect(dbSource).toContain("flatRate: data.flatRate ?? null");
    expect(routerSource.match(/rateType: isHourly \? "hourly" : "flat"/g)?.length).toBeGreaterThanOrEqual(1);
    expect(routerSource).toContain("rateType: input.rateType");
  });

  it("renders the weekly invoice controls in the active artist dashboard", () => {
    expect(bookingsSource).toContain("export function ArtistRecurringBookings");
    expect(artistSource).toContain("<ArtistRecurringBookings />");
  });

  it("keeps uploaded weekly receipt URLs", () => {
    expect(bookingsSource).toContain("fileUrl = up.url");
    expect(bookingsSource).not.toContain("fileUrl = (up as any)?.fileUrl");
  });
});
