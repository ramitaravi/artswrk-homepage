import "dotenv/config";
import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { ENV } from "./_core/env";

describe("Stripe Connect configuration", () => {
  it("can create an Express account and an onboarding Account Link", async () => {
    expect(ENV.stripeSecretKey).toMatch(/^sk_(test|live)_/);

    const stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2026-03-25.dahlia" });
    const account = await stripe.accounts.create({
      type: "express",
      email: `connect-config-test-${Date.now()}@example.com`,
      business_type: "individual",
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    });
    expect(account.id).toMatch(/^acct_/);

    const link = await stripe.accountLinks.create({
      account: account.id,
      type: "account_onboarding",
      return_url: "http://localhost:3000/stripe-connect/callback?state=test",
      refresh_url: "http://localhost:3000/stripe-connect/refresh?state=test",
    });
    expect(link.url).toMatch(/^https:\/\/connect\.stripe\.com\//);
  }, 20_000);
});
