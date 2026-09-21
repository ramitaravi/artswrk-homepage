/**
 * Artists can remove an expense they added — but only their own, and only
 * until it has been invoiced, because the studio is billed for what was there.
 */
import { describe, it, expect } from "vitest";
import { assertReimbursementRemovable } from "./reimbursementAccess";

const booking = { artistUserId: 42, artswrkInvoiceSubmittedAt: null, paymentStatus: "Unpaid" };
const weekExpense = { artistUserId: 42, bookingId: 10, bookingPeriodId: 7 };
const oneOffExpense = { artistUserId: 42, bookingId: 10, bookingPeriodId: null };
const remove = (over: Partial<Parameters<typeof assertReimbursementRemovable>[0]>) =>
  () => assertReimbursementRemovable({ userId: 42, reimbursement: weekExpense, booking, period: { bookingId: 10, status: "open" }, ...over });

describe("assertReimbursementRemovable", () => {
  it("lets the artist remove a week's expense before submitting hours", () => {
    expect(remove({})).not.toThrow();
    expect(remove({ period: { bookingId: 10, status: "upcoming" } })).not.toThrow();
  });

  it("locks a week's expenses once its hours are submitted or paid", () => {
    expect(remove({ period: { bookingId: 10, status: "artist_submitted" } })).toThrow(/already submitted/);
    expect(remove({ period: { bookingId: 10, status: "client_paid" } })).toThrow(/already submitted/);
  });

  it("refuses anyone but the artist who added it", () => {
    expect(remove({ userId: 99 })).toThrow("Not authorized");
    expect(remove({ reimbursement: { ...weekExpense, artistUserId: 99 } })).toThrow("Not authorized");
    expect(remove({ booking: { ...booking, artistUserId: 99 } })).toThrow("Not authorized");
  });

  it("refuses a week that belongs to another booking", () => {
    expect(remove({ period: { bookingId: 11, status: "open" } })).toThrow("Not authorized");
  });

  it("refuses a missing expense or booking", () => {
    expect(remove({ reimbursement: null })).toThrow("Not authorized");
    expect(remove({ booking: null })).toThrow("Not authorized");
  });

  it("lets a one-off booking's expense go until the invoice is submitted", () => {
    expect(remove({ reimbursement: oneOffExpense, period: null })).not.toThrow();
    expect(remove({ reimbursement: oneOffExpense, period: null, booking: { ...booking, artswrkInvoiceSubmittedAt: new Date() } })).toThrow(/already been invoiced/);
    expect(remove({ reimbursement: oneOffExpense, period: null, booking: { ...booking, paymentStatus: "Paid" } })).toThrow(/already been invoiced/);
  });
});
