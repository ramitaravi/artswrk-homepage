import "dotenv/config";
const { isJobUnlocked } = await import("../server/db.ts");
console.log("Journey (now subscriber) on a premium job:", await isJobUnlocked(781519, 1110002));
console.log("On Stage America (now subscriber):       ", await isJobUnlocked(781515, 1110002));
console.log("REVEL (on-demand, manual unlock job 990228):", await isJobUnlocked(780544, 990228));
console.log("REVEL on a job they did NOT unlock (1110002):", await isJobUnlocked(780544, 1110002));
process.exit(0);
