import "dotenv/config";
const { isJobUnlocked, isClientJobUnlocked } = await import("../server/db.ts");

console.log("=== Brittany Girardin (client_on_demand; job 2193770 has legacy jobs.unlocked=1) ===");
for (const jobId of [2193769, 2193770, 2193771]) {
  console.log(`  job ${jobId}: unlocked = ${await isClientJobUnlocked(27270455, jobId)}`);
}
console.log("\n=== enterprise SUBSCRIBER (Accelerate) — expect true ===");
console.log(`  premium job: ${await isJobUnlocked(1110221, 1110002)}`);
console.log("\n=== enterprise ON-DEMAND, no unlock row (Journey) — expect false ===");
console.log(`  premium job: ${await isJobUnlocked(781519, 1110002)}`);
process.exit(0);
