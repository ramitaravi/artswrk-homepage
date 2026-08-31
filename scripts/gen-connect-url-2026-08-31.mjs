import "dotenv/config";
import { createArtistExpressAccount, createConnectOnboardingUrl } from "../server/stripe.ts";

const accountId = await createArtistExpressAccount("connect-live-test-2026-08-31b@example.com");
console.log("created test account:", accountId);
const url = await createConnectOnboardingUrl(999999999, accountId, "http://localhost:3000");
console.log(url);
process.exit(0);
