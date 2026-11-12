import { describe, expect, it } from "vitest";
import { requestJson } from "./http";

// Opt-in, read-only configuration check. Routine tests must never contact providers.
const enabled = process.env.DATA_HUB_VERIFY_SECRETS === "1";
describe.skipIf(!enabled)("Data Hub provider credentials (read-only)", () => {
  it("authenticates the HubSpot token with contacts read access", async () => {
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    expect(Boolean(token?.trim()), "HUBSPOT_ACCESS_TOKEN must be configured").toBe(true);
    const response = await requestJson("api.hubapi.com", "/crm/v3/objects/contacts?limit=1&properties=", {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Do not log the response: it may contain contact data.
    expect(response.status, "HubSpot read-only authentication status").toBe(200);
  }, 35000);
});
