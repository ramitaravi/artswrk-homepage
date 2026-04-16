/**
 * Probe: Discover Bubble type names and record counts.
 * Tries a list of candidate type names and reports which ones exist.
 *
 * Usage:
 *   BUBBLE_API_TOKEN=<token> npx tsx scripts/migration/probe-types.ts
 */

const BUBBLE_API_BASE = "https://artswrk.com/api/1.1/obj";
const TOKEN = process.env.BUBBLE_API_TOKEN;
if (!TOKEN) throw new Error("BUBBLE_API_TOKEN required");

async function probe(type: string): Promise<{ exists: boolean; count: number; sample: any }> {
  try {
    const res = await fetch(`${BUBBLE_API_BASE}/${encodeURIComponent(type)}?limit=2&cursor=0`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) return { exists: false, count: 0, sample: null };
    const data = await res.json();
    const { results, remaining, count } = data.response ?? {};
    const total = (results?.length ?? 0) + (remaining ?? 0);
    return { exists: true, count: total, sample: results?.[0] ?? null };
  } catch {
    return { exists: false, count: 0, sample: null };
  }
}

async function main() {
  const candidates = [
    // ── Interested Artists (regular job applicants) ──────────────────────────
    "interested artists",
    "interested_artist",
    "InterestedArtist",
    "applicant",

    // ── Lead List ─────────────────────────────────────────────────────────────
    "lead list",
    "lead_list",
    "Lead",
    "lead",
    "LeadList",

    // ── Log ───────────────────────────────────────────────────────────────────
    "log",
    "Log",
    "activity_log",
    "ActivityLog",
    "audit_log",

    // ── Map ───────────────────────────────────────────────────────────────────
    "map",
    "Map",
    "location_map",
    "LocationMap",
    "map_pin",
    "MapPin",

    // ── Other likely types we haven't migrated yet ─────────────────────────
    "message",
    "Message",
    "review",
    "Review",
    "reimbursement",
    "Reimbursement",
    "payment",
    "Payment",
    "blog post",
    "BlogPost",
    "blog_post",
    "notification",
    "Notification",
    "premium_job",
    "premium job",
    "PremiumJob",
    "request",
    "Request",
    "resume",
    "Resume",
    "ad",
    "Ad",
  ];

  console.log("Probing Bubble types...\n");
  console.log("Type Name".padEnd(36), "Count");
  console.log("─".repeat(50));

  const found: { type: string; count: number; sample: any }[] = [];

  for (const type of candidates) {
    const result = await probe(type);
    if (result.exists) {
      console.log(`✓  ${type.padEnd(34)} ${result.count.toLocaleString()}`);
      found.push({ type, count: result.count, sample: result.sample });
    } else {
      console.log(`✗  ${type}`);
    }
  }

  console.log("\n── Found types ──────────────────────────────────");
  for (const { type, count, sample } of found) {
    console.log(`\n[${type}] — ${count} records`);
    if (sample) {
      const keys = Object.keys(sample).slice(0, 12);
      console.log("  Fields:", keys.join(", "));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
