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
  activateBoost,
  saveClientStripeCustomerId,
  saveClientSubscriptionId,
  getJobById,
  getUserById,
  saveArtistStripeCustomerId,
  saveArtistProSubscription,
  saveArtistBasicSubscription,
  recordEnterpriseJobUnlock,
  createClientJobUnlock,
  saveEnterpriseStripeCustomerId,
  saveEnterpriseSubscription,
  getMasterServiceTypeName,
} from "./db";
import { sendJobPostedEmail } from "./email";

/**
 * Checkout Session webhook payloads don't include price/line-item detail by
 * default (Stripe doesn't expand nested list resources in webhook events),
 * but a subscription object always carries its price on `items.data[0]`
 * with no expansion needed — so fetch the subscription itself rather than
 * trying to expand the session.
 */
async function getSubscriptionPriceId(subscriptionId: string): Promise<string | null> {
  try {
    const { getStripe } = await import("./stripe");
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return sub.items.data[0]?.price?.id ?? null;
  } catch (err: any) {
    console.error("[Checkout] Failed to fetch subscription price ID:", err.message);
    return null;
  }
}

export async function applyCheckoutSessionCompleted(session: any): Promise<void> {
  const jobId = session.metadata?.job_id ? parseInt(session.metadata.job_id) : null;
  const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id) : null;
  const eventType = session.metadata?.type;

  // Boost and client_job_unlock checkouts both carry job_id (to know which
  // job they're for), but neither one is "a new job was posted" — they used
  // to fall into the block below anyway, silently re-activating an
  // already-active job and sending the wrong "Your job is live!" email
  // instead of ever recording the actual payment (no case existed for
  // either event type until now).
  if (jobId && eventType === "boost") {
    const dailyBudget = session.metadata?.daily_budget ? parseFloat(session.metadata.daily_budget) : 10;
    const durationDays = session.metadata?.duration_days ? parseInt(session.metadata.duration_days) : 7;
    await activateBoost(jobId, { dailyBudget, durationDays, stripeSessionId: session.id });
    if (userId && session.customer) await saveClientStripeCustomerId(userId, session.customer);
    console.log(`[Checkout] Boosted job ${jobId}`);
  } else if (jobId && eventType === "client_job_unlock" && userId) {
    await createClientJobUnlock({
      clientUserId: userId,
      jobId,
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
      amountCents: session.amount_total ?? 4000,
    });
    if (session.customer) await saveClientStripeCustomerId(userId, session.customer);
    console.log(`[Checkout] Unlocked job ${jobId} for client ${userId}`);
  } else if (jobId) {
    await activateJob(jobId);
    console.log(`[Checkout] Activated job ${jobId}`);

    // The paid path's equivalent of what createFreeJob does: a job that goes
    // live inside the 48-hour window skips the 1pm queue and goes out now.
    // activateJob has just put it in the queue, so this is the first moment the
    // check can meaningfully run.
    import("./jobAlerts/lastMinute")
      .then(({ maybeSendLastMinute }) => maybeSendLastMinute(jobId))
      .then((r) => {
        if (r.eligible) console.log(`[last-minute] job ${jobId}: ${r.sent} sent, ${r.capped} capped`);
      })
      .catch((err) => console.error("[last-minute]", err));

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

  if (userId && session.subscription) {
    const priceId = await getSubscriptionPriceId(session.subscription);
    // Check if this is an artist PRO subscription or a client subscription
    if (eventType === "artist_pro_subscription") {
      await saveArtistProSubscription(userId, session.subscription, priceId);
      if (session.customer) await saveArtistStripeCustomerId(userId, session.customer);
      console.log(`[Checkout] Activated artist PRO for user ${userId}`);
    } else if (eventType === "artist_basic_subscription") {
      await saveArtistBasicSubscription(userId, session.subscription, priceId);
      if (session.customer) await saveArtistStripeCustomerId(userId, session.customer);
      console.log(`[Checkout] Activated artist Basic for user ${userId}`);
    } else if (eventType === "enterprise_subscription") {
      const enterpriseInterval = (session.metadata?.interval as "month" | "year" | undefined) ?? undefined;
      await saveEnterpriseSubscription(userId, session.subscription, enterpriseInterval, priceId);
      if (session.customer) await saveEnterpriseStripeCustomerId(userId, session.customer);
      console.log(`[Checkout] Activated enterprise subscription for user ${userId}, interval=${enterpriseInterval}`);
    } else {
      await saveClientSubscriptionId(userId, session.subscription, priceId);
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
      const { markPeriodInvoicePaid, getBookingPeriodById, getBookingById, getUserById: getUser, recordArtswrkPayment } = await import("./db");
      await markPeriodInvoicePaid(periodId, paymentIntentId ?? "");
      console.log(`[Checkout] Admin booking period ${periodId} paid`);
      try {
        const period = await getBookingPeriodById(periodId);
        const booking = period ? await getBookingById(period.bookingId) : null;

        // Pull the full charge (card brand/last4/receipt URL, fee amount) once —
        // used for both the payments-table row and the artist's net amount below.
        let feeCents = 0;
        let chargeId: string | null = null;
        let cardBrand: string | null = null;
        let cardLast4: string | null = null;
        let receiptUrl: string | null = null;
        if (paymentIntentId) {
          try {
            const { getStripe } = await import("./stripe");
            const pi = await getStripe().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
            feeCents = (pi as any).application_fee_amount ?? 0;
            const charge = (pi as any).latest_charge;
            if (charge && typeof charge === "object") {
              chargeId = charge.id ?? null;
              cardBrand = charge.payment_method_details?.card?.brand ?? null;
              cardLast4 = charge.payment_method_details?.card?.last4 ?? null;
              receiptUrl = charge.receipt_url ?? null;
            }
          } catch (feeErr: any) {
            console.error("[Checkout] Couldn't retrieve payment intent detail:", feeErr.message);
          }
        }
        const totalDollars = ((session.amount_total ?? 0) - feeCents) / 100;

        if (booking) {
          await recordArtswrkPayment({
            bookingId: booking.id,
            clientUserId: booking.clientUserId ?? null,
            stripeChargeId: chargeId,
            stripePaymentIntentId: paymentIntentId ?? "",
            grossCents: session.amount_total ?? 0,
            applicationFeeCents: feeCents,
            cardBrand,
            cardLast4,
            receiptUrl,
          });
        }

        const periodLabel = period ? new Date(period.periodStart).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";

        if (booking?.artistUserId) {
          const artist = await getUser(booking.artistUserId);
          if (artist?.email) {
            const { sendArtistPaymentReceivedEmail } = await import("./email");
            await sendArtistPaymentReceivedEmail({
              to: artist.email,
              firstName: artist.firstName ?? "there",
              bookingLabel: periodLabel,
              amount: totalDollars.toFixed(2),
            });
          }
        }
        if (booking?.clientUserId) {
          const client = await getUser(booking.clientUserId);
          if (client?.email) {
            const { sendClientPaymentReceiptEmail } = await import("./email");
            const grossDollars = (session.amount_total ?? 0) / 100;
            const artist = booking.artistUserId ? await getUser(booking.artistUserId) : null;
            await sendClientPaymentReceiptEmail({
              to: client.email,
              firstName: (client as any).clientCompanyName ?? client.firstName ?? "there",
              artistName: artist?.name ?? artist?.firstName ?? "your artist",
              date: periodLabel,
              total: grossDollars.toFixed(2),
            }).catch((e: any) => console.error("[Checkout] Client confirmation email failed:", e.message));
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
      const { markInvoicePaid, getBookingById, getUserById: getUser, recordArtswrkPayment } = await import("./db");
      await markInvoicePaid(bookingId, paymentIntentId ?? "");
      console.log(`[Checkout] Invoice paid for booking ${bookingId}`);

      try {
        const booking = await getBookingById(bookingId);

        // Pull the full charge (card brand/last4/receipt URL, fee amount) once —
        // used for both the payments-table row and the artist's net amount below.
        let feeCents = 0;
        let chargeId: string | null = null;
        let cardBrand: string | null = null;
        let cardLast4: string | null = null;
        let receiptUrl: string | null = null;
        if (paymentIntentId) {
          try {
            const { getStripe } = await import("./stripe");
            const pi = await getStripe().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
            feeCents = (pi as any).application_fee_amount ?? 0;
            const charge = (pi as any).latest_charge;
            if (charge && typeof charge === "object") {
              chargeId = charge.id ?? null;
              cardBrand = charge.payment_method_details?.card?.brand ?? null;
              cardLast4 = charge.payment_method_details?.card?.last4 ?? null;
              receiptUrl = charge.receipt_url ?? null;
            }
          } catch (feeErr: any) {
            console.error("[Checkout] Couldn't retrieve payment intent detail:", feeErr.message);
          }
        }
        // Show what the artist actually receives, not the total the studio
        // paid — that total includes the Artswrk processing fee, which
        // artists never see anywhere else in the product.
        const totalDollars = ((session.amount_total ?? 0) - feeCents) / 100;

        if (booking) {
          await recordArtswrkPayment({
            bookingId: booking.id,
            clientUserId: booking.clientUserId ?? null,
            stripeChargeId: chargeId,
            stripePaymentIntentId: paymentIntentId ?? "",
            grossCents: session.amount_total ?? 0,
            applicationFeeCents: feeCents,
            cardBrand,
            cardLast4,
            receiptUrl,
          });
        }

        // Notify the artist that they've been paid
        if (booking?.artistUserId) {
          const artist = await getUser(booking.artistUserId);
          if (artist?.email) {
            const { sendArtistPaymentReceivedEmail } = await import("./email");
            await sendArtistPaymentReceivedEmail({
              to: artist.email,
              firstName: artist.firstName ?? artist.name ?? "there",
              bookingLabel: `Booking #${bookingId}`,
              amount: totalDollars.toFixed(2),
            });
            console.log(`[Checkout] Sent payment confirmation to artist ${artist.email}`);
          }
        }

        // Notify the client (studio) too — previously only the artist got an
        // Artswrk-branded confirmation; the studio only ever got Stripe's own
        // generic receipt email, if that's even enabled on the account.
        if (booking?.clientUserId) {
          const client = await getUser(booking.clientUserId);
          if (client?.email) {
            const { sendClientPaymentReceiptEmail } = await import("./email");
            const grossDollars = (session.amount_total ?? 0) / 100;
            const artist = booking.artistUserId ? await getUser(booking.artistUserId) : null;
            await sendClientPaymentReceiptEmail({
              to: client.email,
              firstName: (client as any).clientCompanyName ?? client.firstName ?? "there",
              artistName: artist?.name ?? artist?.firstName ?? "your artist",
              date: `Booking #${bookingId}`,
              total: grossDollars.toFixed(2),
            }).catch((e: any) => console.error("[Checkout] Client confirmation email failed:", e.message));
          }
        }
      } catch (notifyErr: any) {
        console.error("[Checkout] Payment notification failed:", notifyErr.message);
      }
    }
  }
}
