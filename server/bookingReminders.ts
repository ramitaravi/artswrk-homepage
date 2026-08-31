/**
 * BOOKING COMPLETION REMINDERS
 * ─────────────────────────────────────────────────────────────────────────────
 * "Complete your booking" — promised in the Terms of Service ("Ten (10)
 * minutes after the Job time begins, the Artist will receive an email to
 * complete the booking and upload any reimbursements") but never actually
 * built. This is that.
 *
 * Fires once per booking, 10 minutes after startDate if it has a real
 * time-of-day, or on the calendar day of startDate if it's a bare date
 * (midnight timestamp — the same "no specific time was set" convention
 * already used elsewhere in this codebase, e.g. JobDetail.tsx's date
 * formatting). Branches on paymentMethod: artswrk-pay bookings get pointed
 * at invoicing, direct-pay bookings get pointed at confirming receipt.
 */
import type { Request, Response } from "express";
import { getDb } from "./db";
import { sendCompleteBookingReminderEmail, sendConfirmDirectPaymentReminderEmail } from "./email";

const APP_URL = process.env.VITE_APP_URL || "https://artswrk.com";

interface DueBooking {
  id: number;
  paymentMethod: string | null;
  artistEmail: string | null;
  artistFirstName: string | null;
}

async function getDueCompletionReminders(): Promise<DueBooking[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(`
    SELECT b.id, b.paymentMethod, a.email AS artistEmail, a.firstName AS artistFirstName
    FROM bookings b
    JOIN users a ON b.artistUserId = a.id
    WHERE b.bookingStatus <> 'Cancelled'
      AND b.deleted = false
      AND b.completionReminderSentAt IS NULL
      AND b.startDate IS NOT NULL
      AND (
        (COALESCE(b.paymentMethod, 'artswrk') = 'artswrk' AND b.artswrkInvoiceSubmittedAt IS NULL)
        OR (b.paymentMethod = 'direct' AND b.directPayConfirmedAt IS NULL)
      )
      AND (
        (TIME(b.startDate) <> '00:00:00' AND b.startDate <= (NOW() - INTERVAL 10 MINUTE))
        OR (TIME(b.startDate) = '00:00:00' AND DATE(b.startDate) <= CURDATE())
      )
    LIMIT 200
  `);
  return rows[0] as unknown as DueBooking[];
}

async function markReminderSent(bookingId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(`UPDATE bookings SET completionReminderSentAt = NOW() WHERE id = ${bookingId}`);
}

export async function handleScheduledBookingCompletionReminders(req: Request, res: Response): Promise<void> {
  const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;
  const forced = req.body?.force === true;
  if (!taskUid && !forced) {
    res.status(403).json({ error: "cron-only endpoint" });
    return;
  }

  res.json({ accepted: true });

  try {
    const due = await getDueCompletionReminders();
    let sent = 0;
    for (const booking of due) {
      try {
        if (booking.artistEmail) {
          const firstName = booking.artistFirstName ?? "there";
          const bookingUrl = `${APP_URL}/app/bookings`;
          if (booking.paymentMethod === "direct") {
            await sendConfirmDirectPaymentReminderEmail({ to: booking.artistEmail, firstName, bookingUrl });
          } else {
            await sendCompleteBookingReminderEmail({ to: booking.artistEmail, firstName, bookingUrl });
          }
        }
        await markReminderSent(booking.id);
        sent++;
      } catch (e) {
        console.error(`[booking-completion-reminders] Booking ${booking.id} failed:`, e);
      }
    }
    console.log(`[booking-completion-reminders] ${sent}/${due.length} sent`);
  } catch (err) {
    console.error("[booking-completion-reminders] Sweep failed:", (err as Error).message);
  }
}
