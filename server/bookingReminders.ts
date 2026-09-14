/**
 * BOOKING COMPLETION REMINDERS
 * ─────────────────────────────────────────────────────────────────────────────
 * "Complete your booking" — the Terms of Service describe this email ("Ten (10)
 * minutes after the Job time begins, the Artist will receive an email to
 * complete the booking and upload any reimbursements"). Moved to 10 minutes
 * BEFORE the start at Ramita's request (2026-09-14).
 *
 * Fires once per booking, 10 minutes before startDate if it has a real
 * time-of-day, or on the calendar day of startDate if it's a bare date
 * (midnight timestamp — the same "no specific time was set" convention
 * already used elsewhere in this codebase, e.g. JobDetail.tsx's date
 * formatting). Branches on paymentMethod: artswrk-pay bookings get pointed
 * at invoicing, direct-pay bookings get pointed at confirming receipt.
 *
 * ONLY ON THE DAY OF THE BOOKING (Eastern). A booking whose day has passed is
 * never reminded — see reminderWindow.ts for why.
 */
import type { Request, Response } from "express";
import { getDb, getDuePeriodReminders, markPeriodNotified } from "./db";
import { reminderWindow, completionReminderDueSql } from "./reminderWindow";
import { sendCompleteBookingReminderEmail, sendConfirmDirectPaymentReminderEmail } from "./email";

const APP_URL = process.env.VITE_APP_URL || "https://artswrk.com";

interface DueBooking {
  id: number;
  paymentMethod: string | null;
  artistEmail: string | null;
  artistFirstName: string | null;
}

/** Bookings to remind now. `now` is a parameter so the rule can be dry-run at any time. */
export async function getDueCompletionReminders(now: Date = new Date()): Promise<DueBooking[]> {
  const db = await getDb();
  if (!db) return [];
  const w = reminderWindow(now);
  const rows = await db.execute(`
    SELECT b.id, b.paymentMethod, a.email AS artistEmail, a.firstName AS artistFirstName
    FROM bookings b
    JOIN users a ON b.artistUserId = a.id
    WHERE COALESCE(b.bookingStatus, '') NOT IN ('Cancelled', 'Completed')
      -- A booking that's already settled has nothing left to complete.
      AND COALESCE(b.paymentStatus, '') NOT IN ('Paid', 'Refunded')
      AND b.deleted = false
      -- Recurring admin bookings are reminded per week (sendDuePeriodReminders),
      -- not once for the whole booking.
      AND NOT (COALESCE(b.isAdminBooking, 0) = 1 AND COALESCE(b.isRecurring, 0) = 1)
      AND b.completionReminderSentAt IS NULL
      AND b.startDate IS NOT NULL
      AND (
        (COALESCE(b.paymentMethod, 'artswrk') = 'artswrk' AND b.artswrkInvoiceSubmittedAt IS NULL)
        OR (b.paymentMethod = 'direct' AND b.directPayConfirmedAt IS NULL)
      )
      AND ${completionReminderDueSql(w)}
    LIMIT 200
  `);
  return rows[0] as unknown as DueBooking[];
}

async function markReminderSent(bookingId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(`UPDATE bookings SET completionReminderSentAt = NOW() WHERE id = ${bookingId}`);
}

/**
 * Recurring admin bookings (weekly classes): each week is its own booking to
 * complete, so the same "Complete Your Booking" email goes out on each class
 * day at the week's reminder time, and the week opens for hours. Weeks skipped
 * for holidays never match. A week whose class day has already passed (Eastern)
 * is opened for hours without an email — never reminded late.
 */
export async function sendDuePeriodReminders(now: Date = new Date()): Promise<{ sent: number; opened: number; total: number }> {
  const due = await getDuePeriodReminders(now);
  let sent = 0;
  let opened = 0;
  for (const period of due) {
    try {
      if (Number(period.recent) && period.artistEmail) {
        await sendCompleteBookingReminderEmail({
          to: period.artistEmail,
          firstName: period.artistFirstName ?? "there",
          bookingUrl: `${APP_URL}/app/bookings`,
        });
        sent++;
      } else {
        opened++;
      }
      await markPeriodNotified(period.id);
    } catch (e) {
      console.error(`[period-reminders] Period ${period.id} failed:`, e);
    }
  }
  return { sent, opened, total: due.length };
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

    const weeks = await sendDuePeriodReminders();
    console.log(`[booking-completion-reminders] recurring weeks: ${weeks.sent} reminded, ${weeks.opened} opened without email`);
  } catch (err) {
    console.error("[booking-completion-reminders] Sweep failed:", (err as Error).message);
  }
}
