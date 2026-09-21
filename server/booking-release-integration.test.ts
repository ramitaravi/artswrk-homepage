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

  it("lists weekly class bookings one row per week, submitted via Complete Booking", () => {
    // Artists see a booking per class date (as in Bubble), not a periods panel;
    // each week's detail page opens the Submit Hours popup.
    expect(artistSource).toContain("expandWeeklyBookingRows(data ?? [], (adminBookings as any[]) ?? [])");
    expect(artistSource).toContain("<PeriodSubmitModal");
    expect(artistSource).toContain("Complete Booking");
    expect(artistSource).not.toContain("<ArtistRecurringBookings />");
    expect(bookingsSource).toContain("export function PeriodSubmitModal");
  });

  it("marks a booking Completed, not Confirmed, once its invoice is paid", () => {
    const dbSource = readFileSync(path.join(root, "server/db.ts"), "utf8");
    const fn = dbSource.slice(dbSource.indexOf("export async function markInvoicePaid("));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).toContain("ELSE 'Completed'");
    expect(body).not.toContain('bookingStatus: "Confirmed"');
    // …but never closes out a weekly class booking that still has weeks to run.
    expect(body).toContain("WHEN ${bookings.isRecurring} = 1 THEN ${bookings.bookingStatus}");
  });

  it("never shows artists what the studio is charged in the Submit Hours popup", () => {
    expect(bookingsSource).not.toContain("Studio pays");
  });

  it("keeps uploaded weekly receipt URLs", () => {
    expect(bookingsSource).toContain("fileUrl = up.url");
    expect(bookingsSource).not.toContain("fileUrl = (up as any)?.fileUrl");
  });
});
