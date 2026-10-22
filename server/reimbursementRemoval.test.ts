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

  it("still lets a week's expenses be fixed after submitting, before payment", () => {
    // This used to throw. Marlon attached the wrong travel receipt, submitted,
    // then "wasn't able to remove the wrong one" -- it took a SQL DELETE.
    // Removing one now withdraws the open invoice and he resubmits.
    expect(remove({ period: { bookingId: 10, status: "artist_submitted" } })).not.toThrow();
  });

  it("locks a week's expenses once the client has paid", () => {
    expect(remove({ period: { bookingId: 10, status: "client_paid" } })).toThrow(/has been paid/);
  });

  it("refuses anyone who is not a party to the booking", () => {
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

  it("lets a one-off booking's expense go until the money moves", () => {
    expect(remove({ reimbursement: oneOffExpense, period: null })).not.toThrow();
    // Submitted but unpaid is still fixable -- the invoice gets withdrawn.
    expect(remove({ reimbursement: oneOffExpense, period: null, booking: { ...booking, artswrkInvoiceSubmittedAt: new Date() } })).not.toThrow();
    expect(remove({ reimbursement: oneOffExpense, period: null, booking: { ...booking, paymentStatus: "Paid" } })).toThrow(/has been paid/);
  });

  it("lets the CLIENT fix an expense too, not only the artist", () => {
    // A studio disputing a line should not have to email support.
    expect(remove({ userId: 99, booking: { ...booking, clientUserId: 99 } })).not.toThrow();
  });
});
