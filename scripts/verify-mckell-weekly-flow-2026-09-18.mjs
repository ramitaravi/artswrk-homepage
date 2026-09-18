import "dotenv/config";
import mysql from "mysql2/promise";
import { bookingMoney } from "../shared/bookingRates.ts";
import { getStripe } from "../server/stripe.ts";

const checks = [];
const check = (ok, label, detail = "") => {
  checks.push({ ok: !!ok, label, detail });
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};
const maskEmail = (email) => {
  if (!email || !String(email).includes("@")) return "missing";
  const [name, domain] = String(email).split("@");
  return `${name.slice(0, 2)}***@${domain}`;
};
const maskId = (id) => id ? `${String(id).slice(0, 5)}…${String(id).slice(-4)}` : "missing";

const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [artists] = await db.query(
    `SELECT id, firstName, lastName, name, email, planTier, deactivatedAt, artistStripeAccountId
       FROM users
      WHERE LOWER(COALESCE(firstName, '')) = 'mckell'
         OR LOWER(COALESCE(name, '')) LIKE '%mckell%'
      ORDER BY id`
  );
  check(artists.length === 1, "exactly one McKell artist account found", `found ${artists.length}`);
  if (artists.length !== 1) process.exitCode = 1;
  const artist = artists[0];
  if (!artist) throw new Error("McKell account not found");

  console.log(`\nArtist: ${artist.firstName ?? artist.name} ${artist.lastName ?? ""} (#${artist.id}), ${maskEmail(artist.email)}`);
  check(!artist.deactivatedAt, "artist account is active");
  check(!!artist.email, "artist email exists", maskEmail(artist.email));
  check(!!artist.artistStripeAccountId, "Stripe Connect account is stored", maskId(artist.artistStripeAccountId));

  const [bookings] = await db.query(
    `SELECT b.id, b.clientUserId, b.bookingStatus, b.paymentStatus, b.paymentMethod,
            b.deleted, b.isAdminBooking, b.isRecurring, b.recurringCadence,
            b.rateType, b.hourlyRate, b.flatRate, b.artistRate, b.clientRate,
            b.hours, b.startDate, b.endDate, b.description,
            c.email AS clientEmail, c.clientCompanyName, c.firstName AS clientFirstName,
            c.deactivatedAt AS clientDeactivatedAt
       FROM bookings b
       LEFT JOIN users c ON c.id = b.clientUserId
      WHERE b.artistUserId = ?
        AND COALESCE(b.isAdminBooking, 0) = 1
        AND COALESCE(b.isRecurring, 0) = 1
        AND COALESCE(b.deleted, 0) = 0
      ORDER BY b.id`,
    [artist.id]
  );

  check(bookings.length > 0, "McKell has active recurring bookings", `${bookings.length} booking(s)`);
  let openPeriods = 0;
  for (const booking of bookings) {
    const [periods] = await db.query(
      `SELECT p.id, p.periodNumber, p.periodStart, p.periodEnd, p.notifyArtistAt,
              p.status, p.actualHours, p.artistSubmittedAt, p.invoiceTotalCents,
              p.invoiceStripeCheckoutUrl,
              COALESCE(SUM(r.value), 0) AS reimbursementsTotal,
              COUNT(r.id) AS reimbursementCount
         FROM booking_periods p
         LEFT JOIN reimbursements r ON r.bookingPeriodId = p.id
        WHERE p.bookingId = ?
        GROUP BY p.id
        ORDER BY p.periodStart`,
      [booking.id]
    );

    const company = booking.clientCompanyName ?? booking.clientFirstName ?? `Client #${booking.clientUserId}`;
    const rate = Number(booking.hourlyRate ?? booking.artistRate ?? 0);
    console.log(`\nBooking #${booking.id}: ${company}; $${rate.toFixed(2)}/hr × ${booking.hours ?? "variable"} scheduled hrs`);
    check(booking.bookingStatus !== "Cancelled", `booking #${booking.id} is not cancelled`, String(booking.bookingStatus));
    check(booking.paymentStatus !== "Paid", `booking #${booking.id} is not already fully paid`, String(booking.paymentStatus));
    check(booking.paymentMethod !== "direct", `booking #${booking.id} invoices through Artswrk`, String(booking.paymentMethod ?? "artswrk (legacy default)"));
    check(booking.rateType === "hourly", `booking #${booking.id} has explicit hourly rate basis`, `${booking.rateType}/${booking.hourlyRate}`);
    check(rate > 0, `booking #${booking.id} has a usable hourly rate`, `$${rate.toFixed(2)}/hr`);
    check(!!booking.clientEmail && !booking.clientDeactivatedAt, `booking #${booking.id} has an active client invoice recipient`, maskEmail(booking.clientEmail));
    check(periods.length > 0, `booking #${booking.id} has billing periods`, `${periods.length} period(s)`);

    for (const period of periods) {
      if (period.status !== "open") continue;
      openPeriods += 1;
      const hours = Number(period.actualHours ?? booking.hours ?? 0);
      const reimbursements = Number(period.reimbursementsTotal ?? 0);
      const money = bookingMoney(
        { rateType: "hourly", hourlyRate: rate, hours: Number(booking.hours ?? 0) },
        { hoursOverride: hours, reimbursements },
      );
      console.log(`  Open period #${period.id} (${new Date(period.periodStart).toISOString().slice(0, 10)}): ${hours} hrs, $${reimbursements.toFixed(2)} reimbursements`);
      check(hours > 0, `period #${period.id} has submit-ready hours`, String(hours));
      check(!period.artistSubmittedAt && !period.invoiceTotalCents && !period.invoiceStripeCheckoutUrl,
        `period #${period.id} has not already been invoiced`);
      check(money.artistTotal > 0 && money.clientTotal > money.artistTotal,
        `period #${period.id} totals calculate correctly`,
        `artist $${money.artistTotal.toFixed(2)}; client $${money.clientTotal.toFixed(2)}; fee $${money.processingFee.toFixed(2)}`);
    }
  }
  check(openPeriods > 0, "McKell has at least one open week she can submit now", `${openPeriods} open period(s)`);

  if (artist.artistStripeAccountId) {
    try {
      const account = await getStripe().accounts.retrieve(artist.artistStripeAccountId);
      check(!account.deleted, "Stripe Connect account exists in the active Stripe mode");
      if (!account.deleted) {
        check(account.details_submitted, "Stripe Connect onboarding details are submitted");
        check(account.charges_enabled, "Stripe Connect charges are enabled");
        check(account.payouts_enabled, "Stripe Connect payouts are enabled");
      }
    } catch (error) {
      check(false, "Stripe Connect account exists in the active Stripe mode", error?.message ?? String(error));
    }
  }

  console.log(`\n${checks.filter((c) => !c.ok).length ? "FLOW NOT READY" : "FLOW READY"}: ${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
  if (checks.some((c) => !c.ok)) process.exitCode = 1;
} finally {
  await db.end();
}
