/**
 * The rules that replace nine SQL scripts. Each case below is a real incident
 * from the three weeks before this was built.
 */
import { describe, it, expect } from "vitest";
import {
  canEditField, canCancel, canMarkPaid, canEditReimbursements,
  cancellationNotice, isSettled, hasOpenInvoice,
} from "./bookingEdits";

const ARTIST = 781139, CLIENT = 1020767, STRANGER = 999;
const base = { artistUserId: ARTIST, clientUserId: CLIENT, bookingStatus: "Confirmed", paymentStatus: "Unpaid" };
const paid = { ...base, bookingStatus: "Completed", paymentStatus: "Paid", invoicePaidAt: new Date("2026-10-14") };
const invoiced = { ...base, bookingStatus: "Pay Now", artswrkInvoiceSubmittedAt: new Date("2026-10-12") };

describe("who may edit what", () => {
  it("lets either side change logistics", () => {
    expect(canEditField(base, "locationAddress", "artist", ARTIST).allowed).toBe(true);
    expect(canEditField(base, "startDate", "client", CLIENT).allowed).toBe(true);
  });

  it("refuses someone who isn't on the booking", () => {
    expect(canEditField(base, "startDate", "artist", STRANGER).allowed).toBe(false);
    expect(canCancel(base, "client", STRANGER).allowed).toBe(false);
  });

  it("will not let either side change the rate alone", () => {
    // Neither "the studio quietly dropped my rate" nor "the artist raised it".
    const a = canEditField(base, "hourlyRate", "artist", ARTIST);
    const c = canEditField(base, "hourlyRate", "client", CLIENT);
    expect(a.allowed).toBe(false);
    expect(c.allowed).toBe(false);
    expect(a.reason).toMatch(/both agreed/);
  });

  it("lets an admin change the rate directly — McKell's $18 to $20", () => {
    expect(canEditField(base, "hourlyRate", "admin").allowed).toBe(true);
    expect(canEditField(base, "hours", "admin").allowed).toBe(true);
  });
});

describe("paid is history", () => {
  it("refuses every edit once money has moved", () => {
    expect(isSettled(paid)).toBe(true);
    expect(canEditField(paid, "startDate", "admin").allowed).toBe(false);
    expect(canEditField(paid, "hourlyRate", "admin").allowed).toBe(false);
    expect(canCancel(paid, "admin").allowed).toBe(false);
    expect(canEditReimbursements(paid, "artist", ARTIST).allowed).toBe(false);
  });

  it("points at the adjustment route instead of just saying no", () => {
    expect(canEditField(paid, "startDate", "admin").reason).toMatch(/adjustment/);
    expect(canCancel(paid, "admin").reason).toMatch(/refund/);
  });

  it("will not mark the same booking paid twice", () => {
    expect(canMarkPaid(paid, "admin").allowed).toBe(false);
  });
});

describe("marking paid is admin-only", () => {
  it("refuses an artist and a studio", () => {
    expect(canMarkPaid(base, "artist").allowed).toBe(false);
    expect(canMarkPaid(base, "client").allowed).toBe(false);
    expect(canMarkPaid(base, "admin").allowed).toBe(true);
  });
});

describe("an open invoice", () => {
  it("is withdrawn by an edit, so the two can never disagree", () => {
    expect(hasOpenInvoice(invoiced)).toBe(true);
    expect(canEditField(invoiced, "startDate", "artist", ARTIST)).toEqual({ allowed: true, withdrawsInvoice: true });
    expect(canCancel(invoiced, "client", CLIENT).withdrawsInvoice).toBe(true);
  });

  it("is not withdrawn when there was no invoice out", () => {
    expect(canEditField(base, "startDate", "artist", ARTIST).withdrawsInvoice).toBe(false);
  });
});

describe("reimbursements — Marlon's wrong travel receipt", () => {
  it("either side may fix them until the booking is paid", () => {
    expect(canEditReimbursements(base, "artist", ARTIST).allowed).toBe(true);
    expect(canEditReimbursements(base, "client", CLIENT).allowed).toBe(true);
    expect(canEditReimbursements(base, "admin").allowed).toBe(true);
  });
});

describe("cancellation notice", () => {
  const now = new Date("2026-10-22T12:00:00Z");

  it("records how much warning there was", () => {
    const week = cancellationNotice(new Date("2026-10-29T12:00:00Z"), now);
    expect(week.noticeHours).toBe(168);
    expect(week.isLate).toBe(false);
  });

  it("flags a same-day cancellation as late — Katya on Armonk", () => {
    const sameDay = cancellationNotice(new Date("2026-10-22T16:00:00Z"), now);
    expect(sameDay.noticeHours).toBe(4);
    expect(sameDay.isLate).toBe(true);
  });

  it("treats a class already past as late", () => {
    expect(cancellationNotice(new Date("2026-10-20T12:00:00Z"), now).isLate).toBe(true);
  });

  it("never blocks a cancellation, however late", () => {
    // The point is the record, not a veto: blocking it does not make the
    // artist turn up.
    expect(canCancel({ ...base, startDate: new Date("2026-10-22T13:00:00Z") }, "artist", ARTIST).allowed).toBe(true);
  });

  it("copes with no date at all", () => {
    expect(cancellationNotice(null, now)).toEqual({ noticeHours: null, isLate: false });
  });
});
