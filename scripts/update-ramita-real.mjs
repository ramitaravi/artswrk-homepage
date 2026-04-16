/**
 * update-ramita-real.mjs
 * Updates user 781130 (ramitaravi.94@gmail.com - the real Ramita account)
 * with correct data from Bubble artist record (1653048240176x373600625789868540)
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const BUBBLE_CDN = "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io";

function fixUrl(url) {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${BUBBLE_CDN}${url}`;
  return url;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // From Bubble artist record (1653048240176x373600625789868540):
  // Portfolio photos (3 images from the orange background dance shoot)
  const portfolioPhotos = [
    "//118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1750110072575x986814561301270400/Untitled%20design.jpg",
    "//118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1750110154098x217571165670180640/IMG_0802.JPG",
    "//118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1750110185316x210908343273897630/Screenshot%202025-06-16%20at%205.42.58%E2%80%AFPM.png",
  ].map(fixUrl).filter(Boolean);
  
  // Resume file
  const resumeFiles = JSON.stringify([{
    url: fixUrl("//118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1750109867078x565466284571430460/Ramita%20Ravi%20-%20MASTER%20RESUME%20%282%29%20%281%29.pdf"),
    name: "Rami - Bloc Dance Resume"
  }]);
  
  // Profile picture (the newer one from Bubble)
  const profilePicture = fixUrl("//118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1750110247150x353487050452178560/Screenshot%202025-06-16%20at%205.44.00%E2%80%AFPM.png");
  
  // Master artist types (from screenshot: Dance Adjudicator, Dance Educator)
  const masterArtistTypes = JSON.stringify(["Dance Adjudicator", "Dance Educator"]);
  
  // Media photos
  const mediaPhotos = JSON.stringify(portfolioPhotos);
  
  // Bio from Bubble
  const bio = "Ramita Ravi is a professional dancer, choreographer, and educator in NYC. She graduated from UPenn and is currently signed with Bloc Talent Agency. Her performance career spans TV/Film/Theater. She was the first South Asian to be featured on So You Think You Can Dance (Season 14) and has been seen in Spinning Gold with Jeremy Jordan & Wiz Khalifa, Last Week Tonight with John Oliver, world premiere musical Bhangin' It (La Jolla Playhouse - Dance Captain), New York Fashion Week with Hermès, TNT's \"I Am The Night\" Premier, Viceland, NOWThis, Lincoln Center, ClassPass Live, \"Aida\" (Engeman Theater), and Mystic India: The World Tour. She has choreographed for Miss America 2021, Raveena (US Tour, NPR's Tiny Desk, Music Videos, Coachella), KSHMR (US Tour) DanceOn, Lincoln Center, Capezio and the Philadelphia Museum of Art. She is on faculty with Liberate Artists, Headliners, Star Dance Alliance, Nexus Dance, and Groove and has taught at Broadway Dance Center, Alvin Ailey Extension, Columbia University, and the Pittsburgh Cultural Trust. She co-founded Project Convergence - company in residence at the American Tap Dance Foundation, as well as Artswrk - the professional network for artists and creatives. She is one of few South Asian professional dancers in the industry, and is blazing trails for more diversity in the arts.";
  
  const bubbleCreatedAt = new Date("2022-05-20T12:04:00.176Z");
  const bookingCount = 46;
  const ratingScore = 50; // 5.0 stars × 10
  
  console.log("Updating user 781130 (ramitaravi.94@gmail.com)...");
  console.log("Profile picture:", profilePicture?.slice(0, 80));
  console.log("Media photos count:", portfolioPhotos.length);
  console.log("Resume files:", resumeFiles);
  
  await conn.execute(
    `UPDATE users SET 
      artswrkPro = 1,
      pronouns = 'She/Her/Hers',
      bio = ?,
      location = 'Santa Clarita, CA, USA',
      instagram = 'https://www.instagram.com/ramita.ravi/',
      tiktok = 'https://www.tiktok.com/@ramitaravi?lang=en',
      youtube = 'https://www.youtube.com/channel/UCB60wNev05ZjiZZNix1iXTQ',
      website = 'https://www.ramitaravi.com',
      profilePicture = ?,
      masterArtistTypes = ?,
      mediaPhotos = ?,
      resumeFiles = ?,
      bookingCount = ?,
      ratingScore = ?,
      bubbleCreatedAt = ?
    WHERE id = 781130`,
    [
      bio,
      profilePicture,
      masterArtistTypes,
      mediaPhotos,
      resumeFiles,
      bookingCount,
      ratingScore,
      bubbleCreatedAt,
    ]
  );
  
  console.log("✅ Updated user 781130");
  
  // Verify
  const [rows] = await conn.execute(
    "SELECT id, firstName, artswrkPro, pronouns, masterArtistTypes, profilePicture, mediaPhotos, resumeFiles, bookingCount, ratingScore FROM users WHERE id = 781130"
  );
  const r = rows[0];
  console.log("\nVerification:");
  console.log("  artswrkPro:", r.artswrkPro);
  console.log("  pronouns:", r.pronouns);
  console.log("  masterArtistTypes:", r.masterArtistTypes);
  console.log("  profilePicture:", r.profilePicture?.slice(0, 80));
  console.log("  mediaPhotos:", r.mediaPhotos?.slice(0, 100));
  console.log("  resumeFiles:", r.resumeFiles);
  console.log("  bookingCount:", r.bookingCount);
  console.log("  ratingScore:", r.ratingScore);
  
  await conn.end();
}

main().catch(console.error);
