/**
 * CHECKOUT SESSION EFFECTS
 * ─────────────────────────────────────────────────────────────────────────────
 * Applies the DB/email side-effects of a completed Stripe Checkout Session
 * (job activation, artist Basic/PRO subscription, enterprise subscription,
 * enterprise job unlock, client subscription, admin booking period payment,
 * artswrk invoice payment).
 *
 * Shared by two callers so they can never drift out of sync:
 *   1. The `/api/stripe/webhook` handler (checkout.session.completed event)
 *   2. The `checkout.verifySession` tRPC procedure — a synchronous fallback
 *      the success page calls immediately on return from Stripe, in case the
 *      webhook is slow, misconfigured, or never arrives.
 *
 * Idempotent: safe to call twice for the same session (webhook + verify both
 * firing) since every operation here is an upsert/set, not an increment.
 */
import {
  activateJob,
  saveClientStripeCustomerId,
  saveClientSubscriptionId,
  getJobById,
  getUserById,
  saveArtistStripeCustomerId,
  saveArtistProSubscription,
  saveArtistBasicSubscription,
  recordEnterpriseJobUnlock,
  saveEnterpriseStripeCustomerId,
  saveEnterpriseSubscription,
  getMasterServiceTypeName,
} from "./db";
import { sendJobPostedEmail } from "./email";

export async function applyCheckoutSessionCompleted(session: any): Promise<void> {
  const jobId = session.metadata?.job_id ? parseInt(session.metadata.job_id) : null;
  const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id) : null;

  if (jobId) {
    await activateJob(jobId);
    console.log(`[Checkout] Activated job ${jobId}`);

    // Send "Your job is live!" confirmation email
    try {
      const job = await getJobById(jobId);
      const poster = userId ? await getUserById(userId) : null;
      if (job && poster?.email) {
        const appUrl = process.env.VITE_APP_URL || "https://artswrk.com";
        const serviceTypeName = await getMasterServiceTypeName(job.masterServiceTypeId as any);
        const rateDisplay = job.openRate
          ? "Open rate (negotiable)"
          : job.isHourly && job.clientHourlyRate
          ? `$${job.clientHourlyRate}/hr`
          : job.clientHourlyRate
          ? `$${job.clientHourlyRate} flat`
          : "Rate TBD";
        await sendJobPostedEmail({
          to: poster.email,
          firstName: poster.firstName || poster.name?.split(" ")[0] || "there",
          serviceType: serviceTypeName,
          date: job.startDate
            ? new Date(job.startDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
            : job.dateType === "Ongoing" ? "Ongoing" : "Flexible / TBD",
          location: job.locationAddress || "Location TBD",
          rate: rateDisplay,
          description: job.description || "",
          transportation: !!(job as any).transportation,
          jobLink: `${appUrl}/app/jobs`,
        });
      }
    } catch (emailErr: any) {
      console.error("[Checkout] Email send failed:", emailErr.message);
    }
  }

  if (userId && session.customer) {
    await saveClientStripeCustomerId(userId, session.customer);
  }

  const eventType = session.metadata?.type;

  if (userId && session.subscription) {
    // Check if this is an artist PRO subscription or a client subscription
    if (eventType === "artist_pro_subscription") {
      await saveArtistProSubscription(userId, session.subscription);
      if (session.customer) await saveArtistStripeCustomerId(userId, session.customer);
      console.log(`[Checkout] Activated artist PRO for user ${userId}`);
    } else if (eventType === "artist_basic_subscription") {
      await saveArtistBasicSubscription(userId, session.subscription);
      if (session.customer) await saveArtistStripeCustomerId(userId, session.customer);
      console.log(`[Checkout] Activated artist Basic for user ${userId}`);
    } else if (eventType === "enterprise_subscription") {
      const enterpriseInterval = (session.metadata?.interval as "month" | "year" | undefined) ?? undefined;
      await saveEnterpriseSubscription(userId, session.subscription, enterpriseInterval);
      if (session.customer) await saveEnterpriseStripeCustomerId(userId, session.customer);
      console.log(`[Checkout] Activated enterprise subscription for user ${userId}, interval=${enterpriseInterval}`);
    } else {
      await saveClientSubscriptionId(userId, session.subscription);
    }
    if (session.customer && !["artist_pro_subscription", "artist_basic_subscription", "enterprise_subscription"].includes(eventType)) {
      await saveClientStripeCustomerId(userId, session.customer);
    }
  } else if (userId && session.customer && !session.subscription) {
    if (eventType === "enterprise_job_unlock") {
      // Record the job unlock
      const unlockJobId = session.metadata?.job_id ? parseInt(session.metadata.job_id) : null;
      if (unlockJobId) {
        await recordEnterpriseJobUnlock({
          clientUserId: userId,
          jobId: unlockJobId,
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent ?? null,
          amountCents: session.amount_total ?? 10000,
        });
        await saveEnterpriseStripeCustomerId(userId, session.customer);
        console.log(`[Checkout] Unlocked enterprise job ${unlockJobId} for user ${userId}`);
      }
    } else {
      // One-time payment — save customer ID for client
      await saveClientStripeCustomerId(userId, session.customer);
    }
  }

  // ── Admin Booking Period Payment ─────────────────────────────────────
  if (eventType === "admin_booking_period") {
    const periodId = session.metadata?.booking_period_id ? parseInt(session.metadata.booking_period_id) : null;
    const paymentIntentId = session.payment_intent ?? null;
    if (periodId) {
      const { markPeriodInvoicePaid, getBookingPeriodById, getBookingById, getUserById: getUser } = await import("./db");
      await markPeriodInvoicePaid(periodId, paymentIntentId ?? "");
      console.log(`[Checkout] Admin booking period ${periodId} paid`);
      try {
        const period = await getBookingPeriodById(periodId);
        const booking = period ? await getBookingById(period.bookingId) : null;
        if (booking?.artistUserId) {
          const artist = await getUser(booking.artistUserId);
          if (artist?.email) {
            const { sendSimpleEmail } = await import("./email");
            const totalDollars = (session.amount_total ?? 0) / 100;
            const periodLabel = period ? new Date(period.periodStart).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";
            await sendSimpleEmail({
              to: artist.email,
              subject: `Payment received — ${periodLabel}`,
              html: `<p>Hi ${artist.firstName ?? "there"},</p><p>Your invoice for <strong>${periodLabel}</strong> has been paid.</p><p><strong>Amount: $${totalDollars.toFixed(2)}</strong></p><p>Best,<br/>The Artswrk Team</p>`,
            });
          }
        }
      } catch (e: any) {
        console.error("[Checkout] Period payment notification failed:", e.message);
      }
    }
  }

  // ── Artswrk Invoice Payment ──────────────────────────────────────────
  if (eventType === "artswrk_invoice") {
    const bookingId = session.metadata?.booking_id ? parseInt(session.metadata.booking_id) : null;
    const paymentIntentId = session.payment_intent ?? null;
    if (bookingId) {
      const { markInvoicePaid, getBookingById, getUserById: getUser } = await import("./db");
      await markInvoicePaid(bookingId, paymentIntentId ?? "");
      console.log(`[Checkout] Invoice paid for booking ${bookingId}`);

      // Notify the artist that they've been paid
      try {
        const booking = await getBookingById(bookingId);
        if (booking?.artistUserId) {
          const artist = await getUser(booking.artistUserId);
          if (artist?.email) {
            const { sendSimpleEmail } = await import("./email");
            const totalDollars = (session.amount_total ?? 0) / 100;
            await sendSimpleEmail({
              to: artist.email,
              subject: `Payment Received — Booking #${bookingId}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
                <div style="text-align:center;margin-bottom:24px">
                  <span style="font-size:22px;font-weight:900">
                    <span style="background:linear-gradient(90deg,#FFBC5D,#F25722);-webkit-background-clip:text;-webkit-text-fill-color:transparent">ARTS</span><span style="background:#111;color:#fff;padding:2px 8px;border-radius:4px;margin-left:2px">WRK</span>
                  </span>
                </div>
                <h2 style="color:#111;margin:0 0 16px">Your payment has been received!</h2>
                <p style="color:#444;font-size:15px;margin:0 0 12px">Hi ${artist.firstName ?? artist.name ?? "there"},</p>
                <p style="color:#444;font-size:15px;margin:0 0 20px">Great news — the studio has paid your invoice for Booking #${bookingId}.</p>
                <div style="background:#f9f9f9;border-radius:8px;padding:16px 20px;margin-bottom:20px">
                  <p style="margin:0;font-size:15px;color:#111"><strong>Amount:</strong> $${totalDollars.toFixed(2)}</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#666">Booking #${bookingId}</p>
                </div>
                <p style="color:#444;font-size:14px">Best,<br>The Artswrk Team</p>
              </div>`,
            });
            console.log(`[Checkout] Sent payment confirmation to artist ${artist.email}`);
          }
        }
      } catch (notifyErr: any) {
        console.error("[Checkout] Artist payment notification failed:", notifyErr.message);
      }
    }
  }
}
