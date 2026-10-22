/**
 * What may be changed on a booking, by whom, and when.
 *
 * Nine production incidents in three weeks were each fixed by running SQL
 * against the live database, because nothing in the product could change a
 * booking. This is the rulebook that replaces those scripts, in one place so
 * the server enforces it once rather than every screen remembering to.
 *
 * Pure and dependency-free so both sides can use it and it can be unit tested.
 */

export type ActorRole = "artist" | "client" | "admin" | "system";

/** The bits of a booking these rules care about. */
export interface EditableBooking {
  artistUserId?: number | null;
  clientUserId?: number | null;
  bookingStatus?: string | null;
  paymentStatus?: string | null;
  invoicePaidAt?: Date | string | null;
  artswrkInvoiceSubmittedAt?: Date | string | null;
  startDate?: Date | string | null;
  /** An open rate proposal, if one side has made one. */
  proposedHourlyRate?: number | null;
  proposedFlatRate?: number | null;
  proposedRateBy?: string | null;
  proposedRateAt?: Date | string | null;
  proposedRateReason?: string | null;
}

/**
 * Logistics. Either side may change these freely; the other is told.
 * Deliberately excludes anything that decides what is paid.
 */
export const LOGISTICS_FIELDS = [
  "startDate", "endDate", "locationAddress", "description", "notes",
] as const;

/**
 * Money. Changing one of these changes what somebody receives, so neither an
 * artist nor a studio may do it unilaterally -- they propose and the other
 * accepts. An admin may, and the audit row records that they did.
 */
export const MONEY_FIELDS = [
  "hourlyRate", "flatRate", "rateType", "hours",
  // Admin-set totals: a human overriding the derived amounts entirely.
  "manualArtistTotal", "manualClientTotal",
] as const;

export type EditableField = (typeof LOGISTICS_FIELDS)[number] | (typeof MONEY_FIELDS)[number];

/** Has money moved on this booking? */
export function isSettled(b: EditableBooking | null | undefined): boolean {
  if (!b) return false;
  return !!b.invoicePaidAt || String(b.paymentStatus ?? "").toLowerCase() === "paid";
}

export function isCancelled(b: EditableBooking | null | undefined): boolean {
  return String(b?.bookingStatus ?? "").toLowerCase() === "cancelled";
}

/** An invoice is out and awaiting payment. */
export function hasOpenInvoice(b: EditableBooking | null | undefined): boolean {
  return !!b?.artswrkInvoiceSubmittedAt && !isSettled(b);
}

export interface Decision {
  allowed: boolean;
  /** Why not, phrased for the person who tried. */
  reason?: string;
  /** The edit lands, but an outstanding invoice has to be withdrawn first. */
  withdrawsInvoice?: boolean;
}

const DENY = (reason: string): Decision => ({ allowed: false, reason });

/** Is this actor a party to the booking at all? */
export function isParty(b: EditableBooking, role: ActorRole, userId: number | null | undefined): boolean {
  if (role === "admin" || role === "system") return true;
  if (role === "artist") return !!userId && b.artistUserId === userId;
  if (role === "client") return !!userId && b.clientUserId === userId;
  return false;
}

/**
 * May this actor edit this field?
 *
 * The rule that matters: once money has moved, nothing that would change what
 * was charged may be edited. A correction becomes a new adjustment instead of
 * a rewrite of history -- every one of the nine scripts refused on exactly
 * this, and that logic belongs here rather than in nine places.
 */
export function canEditField(
  b: EditableBooking,
  field: EditableField,
  role: ActorRole,
  userId?: number | null,
): Decision {
  if (!isParty(b, role, userId)) return DENY("This isn't your booking.");
  if (isSettled(b)) {
    return DENY("This booking has been paid, so its details are fixed. An admin can record an adjustment instead.");
  }
  if (isCancelled(b)) return DENY("This booking was cancelled.");

  const isMoney = (MONEY_FIELDS as readonly string[]).includes(field);
  if (isMoney && role !== "admin") {
    return DENY("The rate and hours are what you both agreed. Propose a change and the other side can accept it.");
  }

  // Editing underneath a live invoice would let the studio pay against a
  // figure that no longer matches the booking.
  return { allowed: true, withdrawsInvoice: hasOpenInvoice(b) };
}

/** May this actor cancel? Allowed at any notice -- always recorded, never blocked. */
export function canCancel(b: EditableBooking, role: ActorRole, userId?: number | null): Decision {
  if (!isParty(b, role, userId)) return DENY("This isn't your booking.");
  if (isSettled(b)) return DENY("This booking has been paid and can't be cancelled. An admin can record a refund.");
  if (isCancelled(b)) return DENY("This booking is already cancelled.");
  return { allowed: true, withdrawsInvoice: hasOpenInvoice(b) };
}

/** Only an admin says that money moved. */
export function canMarkPaid(b: EditableBooking, role: ActorRole): Decision {
  if (role !== "admin") return DENY("Only an Artswrk admin can mark a booking paid.");
  if (isSettled(b)) return DENY("This booking is already marked paid.");
  if (isCancelled(b)) return DENY("This booking was cancelled.");
  return { allowed: true };
}

/** Reimbursements are editable by either side until the money moves. */
export function canEditReimbursements(b: EditableBooking, role: ActorRole, userId?: number | null): Decision {
  if (!isParty(b, role, userId)) return DENY("This isn't your booking.");
  if (isSettled(b)) return DENY("This booking has been paid, so its expenses are fixed.");
  return { allowed: true, withdrawsInvoice: hasOpenInvoice(b) };
}

/**
 * Hours of notice given, and whether that counts as late.
 *
 * There is no cutoff on cancelling -- blocking a late cancellation does not
 * stop the artist being absent, it only stops it being written down. So it is
 * recorded instead: "cancelled" and "cancelled four hours before a class a
 * studio had been promised" are different facts.
 */
export const LATE_CANCELLATION_HOURS = 48;

export function cancellationNotice(
  startDate: Date | string | null | undefined,
  now: Date = new Date(),
): { noticeHours: number | null; isLate: boolean } {
  if (!startDate) return { noticeHours: null, isLate: false };
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return { noticeHours: null, isLate: false };
  const hours = Math.round(((start.getTime() - now.getTime()) / 36e5) * 100) / 100;
  // Already past counts as late; it cannot have been more notice than none.
  return { noticeHours: hours, isLate: hours < LATE_CANCELLATION_HOURS };
}


/* ------------------------------------------------------------------ *
 * Rate proposals
 *
 * Neither an artist nor a studio may change the rate alone -- it is what
 * they both agreed. So one side proposes and the other accepts, and only
 * the acceptance moves any money. Until then the booking is unchanged and
 * either side can walk away from it.
 *
 * An admin does not propose: they edit directly, and the audit row records
 * that an admin did it.
 * ------------------------------------------------------------------ */

/** Is there a proposal waiting for an answer? */
export function hasOpenProposal(b: EditableBooking | null | undefined): boolean {
  if (!b) return false;
  return !!b.proposedRateBy
    && (b.proposedHourlyRate != null || b.proposedFlatRate != null);
}

/** Who proposed it: "artist" or "client". */
export function proposedBy(b: EditableBooking | null | undefined): ActorRole | null {
  return hasOpenProposal(b) ? ((b!.proposedRateBy as ActorRole) ?? null) : null;
}

/**
 * May this actor propose a new rate?
 *
 * Only the two sides of the booking, only while it is live and unpaid, and
 * only one proposal at a time -- a second would make it ambiguous which the
 * other side is agreeing to. Withdraw the open one first.
 */
export function canProposeRate(
  b: EditableBooking,
  role: ActorRole,
  userId?: number | null,
): Decision {
  if (role === "admin") {
    return DENY("An admin changes the rate directly rather than proposing it.");
  }
  if (!isParty(b, role, userId)) return DENY("This isn't your booking.");
  if (isSettled(b)) {
    return DENY("This booking has been paid, so the rate is fixed. An admin can record an adjustment.");
  }
  if (isCancelled(b)) return DENY("This booking was cancelled.");
  if (hasOpenProposal(b)) {
    return proposedBy(b) === role
      ? DENY("You already have a rate change waiting. Withdraw it to propose a different one.")
      : DENY("There's a rate change waiting for your answer. Respond to it first.");
  }
  return { allowed: true, withdrawsInvoice: hasOpenInvoice(b) };
}

/**
 * May this actor accept or decline the open proposal?
 *
 * Only the side that did NOT make it. Letting someone accept their own
 * proposal would be a unilateral rate change wearing two hats.
 */
export function canRespondToProposal(
  b: EditableBooking,
  role: ActorRole,
  userId?: number | null,
): Decision {
  if (!hasOpenProposal(b)) return DENY("There's no rate change waiting.");
  if (role === "admin") {
    return DENY("Only the artist or the studio can answer a rate change. An admin can edit the rate directly.");
  }
  if (!isParty(b, role, userId)) return DENY("This isn't your booking.");
  if (isSettled(b)) return DENY("This booking has been paid, so the rate is fixed.");
  if (isCancelled(b)) return DENY("This booking was cancelled.");
  if (proposedBy(b) === role) {
    return DENY("You proposed this. The other side has to accept it.");
  }
  return { allowed: true, withdrawsInvoice: hasOpenInvoice(b) };
}

/** May this actor withdraw the open proposal? Only whoever made it. */
export function canWithdrawProposal(
  b: EditableBooking,
  role: ActorRole,
  userId?: number | null,
): Decision {
  if (!hasOpenProposal(b)) return DENY("There's no rate change to withdraw.");
  if (!isParty(b, role, userId)) return DENY("This isn't your booking.");
  if (proposedBy(b) !== role) return DENY("Only whoever proposed it can withdraw it.");
  return { allowed: true, withdrawsInvoice: false };
}

/** The other side of the booking -- who has to answer a proposal. */
export function counterpartOf(role: ActorRole): "artist" | "client" | null {
  if (role === "artist") return "client";
  if (role === "client") return "artist";
  return null;
}

/** One line describing an open proposal, for either side to read. */
export function proposalSummary(b: EditableBooking | null | undefined): string | null {
  if (!hasOpenProposal(b)) return null;
  const who = proposedBy(b) === "artist" ? "The artist" : "The studio";
  const amount = b!.proposedHourlyRate != null
    ? `$${Number(b!.proposedHourlyRate).toFixed(2)}/hr`
    : `$${Number(b!.proposedFlatRate).toFixed(2)} for the booking`;
  return `${who} proposed ${amount}.`;
}
