/**
 * Seed Ramita's real profile data from artswrk.com into the local DB.
 * Run: node scripts/seed-ramita-profile.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const connection = await mysql.createConnection(DB_URL);

// Ramita's real data from artswrk.com profile
const profileData = {
  name: "Ramita Ravi",
  firstName: "Ramita",
  lastName: "Ravi",
  pronouns: "She/Her/Hers",
  location: "Santa Clarita, CA",
  profilePicture: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/cdn-cgi/image/w=512,h=558,f=auto,dpr=2,fit=contain/f1750110247150",
  artswrkPro: true,
  bookingCount: 46,
  bio: `Ramita Ravi is a professional dancer, choreographer, and educator in NYC. She graduated from UPenn and is currently signed with Bloc Talent Agency. Her performance career spans TV/Film/Theater. She was the first South Asian to be featured on So You Think You Can Dance (Season 14) and has been seen in Spinning Gold with Jeremy Jordan & Wiz Khalifa, Last Week Tonight with John Oliver, world premiere musical Bhangin' It (La Jolla Playhouse - Dance Captain), New York Fashion Week with Hermès, TNT's "I Am The Night" Premier, Viceland, NOWThis, Lincoln Center, ClassPass Live, "Aida" (Engeman Theater), and Mystic India: The World Tour.

She has choreographed for Miss America 2021, Raveena (US Tour, NPR's Tiny Desk, Music Videos, Coachella), KSHMR (US Tour) DanceOn, Lincoln Center, Capezio and the Philadelphia Museum of Art. She is on faculty with Liberate Artists, Headliners, Star Dance Alliance, Nexus Dance, and Groove and has taught at Broadway Dance Center, Alvin Ailey Extension, Columbia University, and the Pittsburgh Cultural Trust.

She co-founded Project Convergence - company in residence at the American Tap Dance Foundation, as well as Artswrk - the professional network for artists and creatives. She is one of few South Asian professional dancers in the industry, and is blazing trails for more diversity in the arts.`,
  workTypes: JSON.stringify(["Dance Adjudicator", "Dance Educator"]),
  artistDisciplines: JSON.stringify([
    "Ballet", "Jazz", "Hip Hop", "Contemporary", "Tap", "Bollywood",
    "Bharatanatyam", "Musical Theater", "Acrobatics"
  ]),
  artistServices: JSON.stringify([
    "Dance Adjudicator", "Dance Educator", "Choreographer", "Performer",
    "Competition Choreographer", "Master Class Teacher"
  ]),
  masterArtistTypes: JSON.stringify(["Dance Educator", "Choreographer", "Performer"]),
  masterStyles: JSON.stringify(["Contemporary", "Hip Hop", "Bollywood", "Jazz", "Tap"]),
  mediaPhotos: JSON.stringify([
    "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/cdn-cgi/image/w=256,h=256,f=auto,dpr=2,fit=contain/f1750110072575",
    "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/cdn-cgi/image/w=256,h=256,f=auto,dpr=2,fit=contain/f1750110154098",
    "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/cdn-cgi/image/w=256,h=256,f=auto,dpr=2,fit=contain/f1750110185316",
  ]),
  resumeFiles: JSON.stringify([
    { name: "Rami - Bloc Dance Resume", url: "https://118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1750110247150x3" }
  ]),
  instagram: "@ramitaravi",
  bubbleCreatedAt: new Date("2022-05-20"),
};

// Find Ramita's user by email
const [rows] = await connection.execute(
  "SELECT id, email FROM users WHERE email = ?",
  ["ramitaravi.94@gmail.com"]
);

if (!rows || rows.length === 0) {
  console.error("User ramitaravi.94@gmail.com not found in DB");
  process.exit(1);
}

const userId = rows[0].id;
console.log(`Found user: id=${userId}, email=${rows[0].email}`);

// Update the profile
await connection.execute(
  `UPDATE users SET
    name = ?,
    firstName = ?,
    lastName = ?,
    pronouns = ?,
    location = ?,
    profilePicture = ?,
    artswrkPro = ?,
    bookingCount = ?,
    bio = ?,
    workTypes = ?,
    artistDisciplines = ?,
    artistServices = ?,
    masterArtistTypes = ?,
    masterStyles = ?,
    mediaPhotos = ?,
    resumeFiles = ?,
    instagram = ?,
    bubbleCreatedAt = ?
  WHERE id = ?`,
  [
    profileData.name,
    profileData.firstName,
    profileData.lastName,
    profileData.pronouns,
    profileData.location,
    profileData.profilePicture,
    profileData.artswrkPro ? 1 : 0,
    profileData.bookingCount,
    profileData.bio,
    profileData.workTypes,
    profileData.artistDisciplines,
    profileData.artistServices,
    profileData.masterArtistTypes,
    profileData.masterStyles,
    profileData.mediaPhotos,
    profileData.resumeFiles,
    profileData.instagram,
    profileData.bubbleCreatedAt,
    userId,
  ]
);

console.log("✅ Ramita's profile seeded successfully!");
await connection.end();
