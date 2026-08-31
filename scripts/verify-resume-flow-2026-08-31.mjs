import "dotenv/config";
import { getStripe, createConnectOnboardingUrl } from "../server/stripe.ts";

// Exercises the exact logic /stripe-connect/callback runs when an artist
// returns before finishing onboarding: check details_submitted, and if
// false, generate a fresh Account Link to send them back into Stripe.
const accountId = "acct_1UAWMjPTxKcpUEMv"; // the in-progress test account from the live click-through
const account = await getStripe().accounts.retrieve(accountId);
console.log("details_submitted:", account.details_submitted);

if (!account.details_submitted) {
  const resumeUrl = await createConnectOnboardingUrl(999999999, accountId, "http://localhost:3000");
  console.log("resume url generated:", resumeUrl);
} else {
  console.log("(would have proceeded to success branch)");
}
process.exit(0);
