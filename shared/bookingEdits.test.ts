/**
 * The rules that replace nine SQL scripts. Each case below is a real incident
 * from the three weeks before this was built.
 */
import { describe, it, expect } from "vitest";
import { canEditField, canCancel, canMarkPaid, canEditReimbursements, cancellationNotice, isSettled, hasOpenInvoice, canProposeRate, canRespondToProposal, canWithdrawProposal, hasOpenProposal, proposalSummary } from "./bookingEdits";

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

describe("admin-set totals", () => {
  const open = { bookingStatus: "Confirmed", paymentStatus: "Unpaid", artistUserId: 1, clientUserId: 2 } as any;

  it("lets an admin set the totals by hand", () => {
    expect(canEditField(open, "manualArtistTotal", "admin").allowed).toBe(true);
    expect(canEditField(open, "manualClientTotal", "admin").allowed).toBe(true);
  });

  it("does not let an artist or client set their own totals", () => {
    expect(canEditField(open, "manualArtistTotal", "artist", 1).allowed).toBe(false);
    expect(canEditField(open, "manualClientTotal", "client", 2).allowed).toBe(false);
  });

  it("will not let even an admin rewrite the totals once it is paid", () => {
    const paid = { ...open, paymentStatus: "Paid" };
    expect(canEditField(paid, "manualArtistTotal", "admin").allowed).toBe(false);
  });
});

describe("rate proposals", () => {
  const live = {
    bookingStatus: "Confirmed", paymentStatus: "Unpaid",
    artistUserId: 1, clientUserId: 2,
  } as any;
  const withProposal = { ...live, proposedHourlyRate: 30, proposedRateBy: "artist" };

  it("lets either side propose a rate on a live booking", () => {
    expect(canProposeRate(live, "artist", 1).allowed).toBe(true);
    expect(canProposeRate(live, "client", 2).allowed).toBe(true);
  });

  it("does not let an admin propose -- they edit directly", () => {
    expect(canProposeRate(live, "admin").allowed).toBe(false);
  });

  it("does not let a stranger propose", () => {
    expect(canProposeRate(live, "artist", 99).allowed).toBe(false);
  });

  it("refuses a second proposal while one is open", () => {
    expect(canProposeRate(withProposal, "artist", 1).allowed).toBe(false);
    expect(canProposeRate(withProposal, "client", 2).allowed).toBe(false);
  });

  it("only lets the OTHER side answer", () => {
    expect(canRespondToProposal(withProposal, "client", 2).allowed).toBe(true);
    // Accepting your own proposal is a unilateral rate change in disguise.
    expect(canRespondToProposal(withProposal, "artist", 1).allowed).toBe(false);
  });

  it("has nothing to answer when no proposal is open", () => {
    expect(canRespondToProposal(live, "client", 2).allowed).toBe(false);
  });

  it("only lets the proposer withdraw", () => {
    expect(canWithdrawProposal(withProposal, "artist", 1).allowed).toBe(true);
    expect(canWithdrawProposal(withProposal, "client", 2).allowed).toBe(false);
  });

  it("stops proposing or answering once the booking is paid", () => {
    const paid = { ...withProposal, paymentStatus: "Paid" };
    expect(canProposeRate(paid, "artist", 1).allowed).toBe(false);
    expect(canRespondToProposal(paid, "client", 2).allowed).toBe(false);
  });

  it("stops proposing or answering once cancelled", () => {
    const dead = { ...withProposal, bookingStatus: "Cancelled" };
    expect(canProposeRate(dead, "artist", 1).allowed).toBe(false);
    expect(canRespondToProposal(dead, "client", 2).allowed).toBe(false);
  });

  it("does not see a half-written proposal as open", () => {
    // A row with a proposer but no amount is not something to answer.
    expect(hasOpenProposal({ ...live, proposedRateBy: "artist" })).toBe(false);
    expect(hasOpenProposal({ ...live, proposedHourlyRate: 30 })).toBe(false);
    expect(hasOpenProposal(withProposal)).toBe(true);
  });

  it("describes an open proposal in one line for either side", () => {
    expect(proposalSummary(withProposal)).toBe("The artist proposed $30.00/hr.");
    expect(proposalSummary({ ...live, proposedFlatRate: 400, proposedRateBy: "client" }))
      .toBe("The studio proposed $400.00 for the booking.");
    expect(proposalSummary(live)).toBeNull();
  });
});
