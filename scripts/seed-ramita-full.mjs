/**
 * Seed Ramita's full profile for ramitaravi.94@gmail.com
 * Run: node scripts/seed-ramita-full.mjs
 */

import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const db = await createConnection(process.env.DATABASE_URL);

// ── 1. Find Ramita's user ID ──────────────────────────────────────────────────
const [users] = await db.execute(
  "SELECT id, email FROM users WHERE email = 'ramitaravi.94@gmail.com' LIMIT 1"
);
if (!users.length) {
  console.error("User ramitaravi.94@gmail.com not found");
  process.exit(1);
}
const userId = users[0].id;
console.log(`Found user id=${userId}`);

// ── 2. Update core profile fields ─────────────────────────────────────────────
await db.execute(
  `UPDATE users SET
    firstName = ?,
    lastName = ?,
    name = ?,
    pronouns = ?,
    location = ?,
    bio = ?,
    profilePicture = ?,
    artswrkPro = 1,
    bookingCount = 46,
    ratingScore = 50,
    reviewCount = 4,
    workTypes = ?,
    mediaPhotos = ?,
    resumeFiles = ?,
    bubbleCreatedAt = ?
  WHERE id = ?`,
  [
    "Ramita",
    "Ravi",
    "Ramita Ravi",
    "She/Her/Hers",
    "Santa Clarita, CA",
    "Ramita Ravi is a professional dancer, choreographer, and educator in NYC. She graduated from UPenn and is currently signed with Bloc Talent Agency. Her performance career spans TV/Film/Theater. She was the first South Asian to be featured on So You Think You Can Dance (Season 14) and has been seen in Spinning Gold with Jeremy Jordan & Wiz Khalifa, Last Week Tonight with John Oliver, world premiere musical Bhangin' It (La Jolla Playhouse - Dance Captain), New York Fashion Week with Hermès, TNT's \"I Am The Night\" Premier, Viceland, NOWThis, Lincoln Center, ClassPass Live, \"Aida\" (Engeman Theater), and Mystic India: The World Tour.",
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-1-aY8po4fr7wkR7kHuYcLRjW.webp",
    JSON.stringify(["Dance Adjudicator", "Dance Educator"]),
    JSON.stringify([
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-1-aY8po4fr7wkR7kHuYcLRjW.webp",
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-2-Vo37fp95iDpS9ybaZkYWJB.webp",
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-3-hjiUkBU9Pft72RAaeq8oxW.webp",
    ]),
    JSON.stringify([
      { url: "https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/rami-bloc-dance-resume.pdf", name: "Rami - Bloc Dance Resume" }
    ]),
    new Date("2022-05-20"),
    userId,
  ]
);
console.log("Updated user profile");

// ── 3. Clear + re-seed service categories ─────────────────────────────────────
await db.execute("DELETE FROM artist_service_categories WHERE artistUserId = ?", [userId]);

const serviceCategories = [
  {
    name: "Dance Adjudicator",
    imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80",
    subServices: ["Dance Competition Judge"],
    sortOrder: 0,
  },
  {
    name: "Dance Educator",
    imageUrl: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&q=80",
    subServices: ["Competition Choreography", "Substitute Teacher", "Recurring Classes", "Private Lessons", "Master Classes", "Event Choreography"],
    sortOrder: 1,
  },
];

for (const cat of serviceCategories) {
  await db.execute(
    `INSERT INTO artist_service_categories (artistUserId, name, imageUrl, subServices, sortOrder)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, cat.name, cat.imageUrl, JSON.stringify(cat.subServices), cat.sortOrder]
  );
}
console.log("Seeded service categories");

// ── 4. Clear + re-seed reviews ────────────────────────────────────────────────
await db.execute("DELETE FROM artist_reviews WHERE artistUserId = ?", [userId]);

const reviews = [
  {
    reviewerName: "Melissa",
    reviewerStudio: "Elite Dance Studio",
    reviewerAvatar: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Elite_Dance_Studio_logo.png/200px-Elite_Dance_Studio_logo.png",
    rating: 5,
    body: "Always the best time! Our dancers love Ramita and look forward to learning from her each year. The Bollywood classes are their favorite.",
    reviewDate: new Date("2023-07-24"),
  },
  {
    reviewerName: "AEDE - Dance Extensions",
    reviewerStudio: "AEDE - Dance Extensions",
    reviewerAvatar: null,
    rating: 5,
    body: "Ramita was a pleasure to work with. Our dancers absolutely loved having her choreograph and already asked when we can have her back!",
    reviewDate: new Date("2023-09-18"),
  },
  {
    reviewerName: "North Shore Performing Arts Center",
    reviewerStudio: "North Shore Performing Arts Center",
    reviewerAvatar: "https://images.unsplash.com/photo-1560439514-4e9645039924?w=80&q=80",
    rating: 5,
    body: "Ramita is wonderful to work with.",
    reviewDate: new Date("2025-03-03"),
  },
  {
    reviewerName: "Studio Owner",
    reviewerStudio: "Dance Academy",
    reviewerAvatar: null,
    rating: 5,
    body: "Always an absolute pleasure to have Ramita at our studio!",
    reviewDate: new Date("2024-06-15"),
  },
];

for (const r of reviews) {
  await db.execute(
    `INSERT INTO artist_reviews (artistUserId, reviewerName, reviewerStudio, reviewerAvatar, rating, body, reviewDate)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, r.reviewerName, r.reviewerStudio, r.reviewerAvatar, r.rating, r.body, r.reviewDate]
  );
}
console.log("Seeded reviews");

await db.end();
console.log("✅ Done! Ramita's full profile is seeded.");
