import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";

describe("Stripe Connect configuration", () => {
  it("accepts the configured OAuth client ID at Stripe's authorization endpoint", async () => {
    expect(ENV.stripeConnectClientId).toMatch(/^ca_[A-Za-z0-9]+$/);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: ENV.stripeConnectClientId,
      scope: "read_write",
      redirect_uri: "http://localhost:3000/stripe-connect/callback",
    });
    const response = await fetch(`https://connect.stripe.com/oauth/authorize?${params.toString()}`, {
      redirect: "manual",
    });
    const body = await response.text();

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(400);
    expect(body.toLowerCase()).not.toContain("invalid_client");
  }, 20_000);
});
