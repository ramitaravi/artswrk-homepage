/**
 * Reference Data Seed — Phase 2 of Bubble migration
 *
 * Seeds the static lookup tables that all other data references:
 *   - masterArtistTypes  (8 records)
 *   - masterServiceTypes (42 records, grouped under artist types)
 *   - danceStyles        (Bubble option set — hardcoded here since not accessible via API)
 *
 * Run once before migrating users, jobs, bookings, etc.
 * Safe to re-run (uses INSERT IGNORE / upsert on bubbleId).
 */

export const MASTER_ARTIST_TYPES = [
  {
    bubbleId: "1652795268178x593637050563690500",
    name: "Dance Educator",
    listingOrder: 1,
    isPublic: true,
    iconUrl: "//s3.amazonaws.com/appforest_uf/f1667425536898x754272702321634400/Copy%20of%20Landing%20Page%20Social%20Asset.png",
  },
  {
    bubbleId: "1652795286947x398019932738813950",
    name: "Dance Adjudicator",
    listingOrder: 2,
    isPublic: true,
    iconUrl: "//118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1749064284874x810797988699827800/2.png",
  },
  {
    bubbleId: "1652795278761x181374835769999360",
    name: "Photographer",
    listingOrder: 3,
    isPublic: true,
    iconUrl: "//118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1749064557170x920884244800897400/5.png",
  },
  {
    bubbleId: "1652795294854x436722279715700740",
    name: "Videographer",
    listingOrder: 4,
    isPublic: true,
    iconUrl: "//118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1749064538990x784158055680999000/6.png",
  },
  {
    bubbleId: "1691084462731x770345954249831000",
    name: "Acting Coach",
    slug: "acting-coach",
    listingOrder: 5,
    isPublic: true,
    iconUrl: "//118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1691085121791x774722483508286600/30.png",
  },
  {
    bubbleId: "1691085338422x528659216544909760",
    name: "Vocal Coach",
    slug: "vocal-coach",
    listingOrder: 6,
    isPublic: true,
    iconUrl: "//118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1691085333714x148809220914045700/31.png",
  },
  {
    bubbleId: "1718896784814x357092022052048100",
    name: "Side Jobs",
    listingOrder: 8,
    isPublic: true,
    iconUrl: "//118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1749064262343x369959202065807360/4.png",
  },
  {
    bubbleId: "1718898900400x704384409316353500",
    name: "Music Teacher",
    listingOrder: 9,
    isPublic: true,
    iconUrl: "//118d26995be0b113d0cb8cb06dbea400.cdn.bubble.io/f1718898894855x171700931015632100/Copy%20of%20Landing%20Page%20Social%20Asset.png",
  },
] as const;

export const MASTER_SERVICE_TYPES = [
  // ── Dance Educator ──────────────────────────────────────────────────────────
  { bubbleId: "1667426487406x181070042319331650", name: "Recurring Classes",          bubbleArtistTypeId: "1652795268178x593637050563690500", listingOrder: 1, isPublic: true,  isMcLandingPage: false },
  { bubbleId: "1667426466101x395522954163220350", name: "Substitute Teacher",          bubbleArtistTypeId: "1652795268178x593637050563690500", listingOrder: 2, isPublic: true,  isMcLandingPage: false },
  { bubbleId: "1667426545732x537694170180569100", name: "Master Classes",              bubbleArtistTypeId: "1652795268178x593637050563690500", listingOrder: 3, isPublic: true,  isMcLandingPage: true  },
  { bubbleId: "1667426513513x195830461663674340", name: "Private Lessons",             bubbleArtistTypeId: "1652795268178x593637050563690500", listingOrder: 4, isPublic: true,  isMcLandingPage: true  },
  { bubbleId: "1667426441226x668855578210537000", name: "Competition Choreography",    bubbleArtistTypeId: "1652795268178x593637050563690500", listingOrder: 5, isPublic: true,  isMcLandingPage: true  },
  { bubbleId: "1692039982283x707749585581281700", name: "Event Choreography",          bubbleArtistTypeId: "1652795268178x593637050563690500", listingOrder: 6, isPublic: true,  isMcLandingPage: false },

  // ── Dance Adjudicator ───────────────────────────────────────────────────────
  { bubbleId: "1667427487394x700952418757107700", name: "Dance Competition Judge",     bubbleArtistTypeId: "1652795286947x398019932738813950", listingOrder: 6, isPublic: true,  isMcLandingPage: false },

  // ── Photographer ────────────────────────────────────────────────────────────
  { bubbleId: "1667427346202x794678862093679700", name: "Photoshoot",                  bubbleArtistTypeId: "1652795278761x181374835769999360", listingOrder: null, isPublic: true, isMcLandingPage: false },
  { bubbleId: "1667427381280x221279175017782720", name: "Corporate Photography",        bubbleArtistTypeId: "1652795278761x181374835769999360", listingOrder: null, isPublic: true, isMcLandingPage: false },
  { bubbleId: "1667427400265x206429292826785900", name: "Event Photography",            bubbleArtistTypeId: "1652795278761x181374835769999360", listingOrder: null, isPublic: true, isMcLandingPage: false },
  { bubbleId: "1667427421859x543996839213308540", name: "Headshots",                   bubbleArtistTypeId: "1652795278761x181374835769999360", listingOrder: null, isPublic: true, isMcLandingPage: false },

  // ── Videographer ────────────────────────────────────────────────────────────
  { bubbleId: "1667427359102x218959320577081660", name: "Videoshoot",                  bubbleArtistTypeId: "1652795294854x436722279715700740", listingOrder: null, isPublic: true, isMcLandingPage: false },
  { bubbleId: "1667427452435x666628224793006800", name: "Corporate Videography",        bubbleArtistTypeId: "1652795294854x436722279715700740", listingOrder: null, isPublic: true, isMcLandingPage: false },
  { bubbleId: "1667427471418x373048905999023600", name: "Event Videography",            bubbleArtistTypeId: "1652795294854x436722279715700740", listingOrder: null, isPublic: true, isMcLandingPage: false },
  { bubbleId: "1690395186368x170090134279697000", name: "Video Editing",                bubbleArtistTypeId: "1652795294854x436722279715700740", listingOrder: null, isPublic: true, isMcLandingPage: false, slug: "video-editing" },

  // ── Acting Coach ────────────────────────────────────────────────────────────
  { bubbleId: "1691085231410x274219669932255230", name: "Acting Coach",                 bubbleArtistTypeId: "1691084462731x770345954249831000", listingOrder: null, isPublic: true, isMcLandingPage: false, slug: "acting-coach" },
  { bubbleId: "1691085284177x603074313316733300", name: "Audition Reader",              bubbleArtistTypeId: "1691084462731x770345954249831000", listingOrder: null, isPublic: true, isMcLandingPage: false },

  // ── Vocal Coach ─────────────────────────────────────────────────────────────
  { bubbleId: "1691085479700x630190703988646800", name: "Private Voice Lessons",        bubbleArtistTypeId: "1691085338422x528659216544909760", listingOrder: null, isPublic: true, isMcLandingPage: false, slug: "private-voice-lessons" },
  { bubbleId: "1691085643601x668859282742115000", name: "Vocal Audition Prep",          bubbleArtistTypeId: "1691085338422x528659216544909760", listingOrder: null, isPublic: true, isMcLandingPage: false },

  // ── Music Teacher ───────────────────────────────────────────────────────────
  { bubbleId: "1718899053365x907646224913887200", name: "Guitar",                       bubbleArtistTypeId: "1718898900400x704384409316353500", listingOrder: null, isPublic: true, isMcLandingPage: false },
  { bubbleId: "1718899064132x178744207513862340", name: "Percussion Teacher",            bubbleArtistTypeId: "1718898900400x704384409316353500", listingOrder: null, isPublic: true, isMcLandingPage: false },
  { bubbleId: "1718899075125x751361432185503400", name: "Saxophone Teacher",             bubbleArtistTypeId: "1718898900400x704384409316353500", listingOrder: null, isPublic: true, isMcLandingPage: false },
  { bubbleId: "1718899087876x574979737497052240", name: "Voice Teacher",                 bubbleArtistTypeId: "1718898900400x704384409316353500", listingOrder: null, isPublic: true, isMcLandingPage: false },
  { bubbleId: "1718899098215x638997767485098400", name: "Woodwind Teacher",              bubbleArtistTypeId: "1718898900400x704384409316353500", listingOrder: null, isPublic: true, isMcLandingPage: false },
  { bubbleId: "1718899107659x598746756621857200", name: "Piano Teacher",                 bubbleArtistTypeId: "1718898900400x704384409316353500", listingOrder: null, isPublic: true, isMcLandingPage: false },
  { bubbleId: "1721170689432x474028599712345900", name: "Violin Teacher",                bubbleArtistTypeId: "1718898900400x704384409316353500", listingOrder: null, isPublic: true, isMcLandingPage: false },
  { bubbleId: "1730319391924x431481604901948700", name: "Cello",                         bubbleArtistTypeId: "1718898900400x704384409316353500", listingOrder: null, isPublic: true, isMcLandingPage: false, slug: "cello" },

  // ── Side Jobs ───────────────────────────────────────────────────────────────
  { bubbleId: "1718897202266x115658361190269070", name: "Copywriter",                   bubbleArtistTypeId: "1718896784814x357092022052048100", listingOrder: null, isPublic: false, isMcLandingPage: false },
  { bubbleId: "1718897223250x258983082573439170", name: "Social Media Manager",          bubbleArtistTypeId: "1718896784814x357092022052048100", listingOrder: null, isPublic: false, isMcLandingPage: false },
  { bubbleId: "1718897238267x936539184257434400", name: "Marketing",                     bubbleArtistTypeId: "1718896784814x357092022052048100", listingOrder: null, isPublic: false, isMcLandingPage: false },
  { bubbleId: "1718897248780x759764859337444500", name: "Graphic Designer",              bubbleArtistTypeId: "1718896784814x357092022052048100", listingOrder: null, isPublic: false, isMcLandingPage: false },
  { bubbleId: "1718897260404x784771885289341400", name: "Catering",                      bubbleArtistTypeId: "1718896784814x357092022052048100", listingOrder: null, isPublic: false, isMcLandingPage: false },
  { bubbleId: "1718897272322x207753323708237400", name: "Front Desk",                    bubbleArtistTypeId: "1718896784814x357092022052048100", listingOrder: null, isPublic: false, isMcLandingPage: false },
  { bubbleId: "1718897284576x110873433218552590", name: "Executive Assistant / Admin",   bubbleArtistTypeId: "1718896784814x357092022052048100", listingOrder: null, isPublic: false, isMcLandingPage: false },
  { bubbleId: "1718897292458x648173263510964100", name: "Fitness",                       bubbleArtistTypeId: "1718896784814x357092022052048100", listingOrder: null, isPublic: false, isMcLandingPage: false },
  { bubbleId: "1718897301734x723011082328963500", name: "Content Creator",               bubbleArtistTypeId: "1718896784814x357092022052048100", listingOrder: null, isPublic: false, isMcLandingPage: false },
  { bubbleId: "1718972194772x237171618015870500", name: "Retail",                        bubbleArtistTypeId: "1718896784814x357092022052048100", listingOrder: null, isPublic: false, isMcLandingPage: false },
  { bubbleId: "1724105478368x370504358015882240", name: "Customer Service",              bubbleArtistTypeId: "1718896784814x357092022052048100", listingOrder: null, isPublic: false, isMcLandingPage: false },

  // ── No artist type (standalone) ─────────────────────────────────────────────
  { bubbleId: "1714772660662x913566450486813600", name: "Event Performers",              bubbleArtistTypeId: null,                              listingOrder: null, isPublic: true,  isMcLandingPage: false },
  { bubbleId: "1715051094382x503930278535975360", name: "Creator",                       bubbleArtistTypeId: null,                              listingOrder: null, isPublic: false, isMcLandingPage: false },
  { bubbleId: "1716473830117x948911198239641200", name: "Yoga Instructor",               bubbleArtistTypeId: null,                              listingOrder: null, isPublic: true,  isMcLandingPage: false },
  { bubbleId: "1716473854064x380187448329175200", name: "Pilates Instructor",            bubbleArtistTypeId: null,                              listingOrder: null, isPublic: true,  isMcLandingPage: false },
] as const;

/**
 * Dance styles — these are Bubble option set values, not a Data API type.
 * IDs were observed in ArtistExperience.Styles arrays.
 * Names were reverse-engineered from the Bubble editor.
 * These need to be stored as a lookup map for the migration scripts.
 */
export const DANCE_STYLES: Record<string, string> = {
  "1667431857988x517050912633392900": "Ballet",
  "1667431857989x939824956503340000": "Jazz",
  "1667431857990x950189415355536600": "Contemporary",
  "1667431857991x273737820659193600": "Tap",
  "1667431857991x284629582400292000": "Hip Hop",
  "1667431857992x400913406360933900": "Lyrical",
  "1667431857994x360980250837864100": "Modern",
  "1667431857997x522002259247100300": "Acro",
  "1667431857998x984942842466625800": "Musical Theatre",
  "1667431857998x700365446818322900": "Tumbling",
  "1667431858000x175436357553468100": "Pointe",
  "1667431858001x588870243649122200": "Ballroom",
  "1667431858002x728976802470368400": "Latin",
  "1667431858002x883577118598879500": "Salsa",
  "1667431858006x910807256967365300": "Swing",
  "1667431858008x191406579965149440": "Baton",
  "1667431858008x236120931678979840": "Cheer",
  "1667431858009x179232850933407140": "Poms",
  "1667431858010x854247187845706200": "Creative Movement",
  "1667431858010x116221179510983760": "Fitness",
  "1667431858017x540756003072406600": "Zumba",
  "1667431858020x253697227345064160": "Country",
  "1667431858022x274382975384477900": "Folkloric",
  "1667431858023x791150491090002200": "African",
  "1667431858027x306783370029907400": "Bollywood",
  "1667431858027x571464156321254340": "Cultural",
  "1667431858028x112617820542771470": "Indian Classical",
  "1667431858277x303163792342008500": "K-Pop",
  "1667431858279x772458789151173000": "Breakdance",
  "1667431858281x314681219583958800": "Voguing",
  "1667431858282x754016485964310800": "Heels",
  "1667431858283x471805475040060400": "Commercial",
  "1667431858283x591314002131724700": "Street Jazz",
  "1667431858284x671770366056475400": "Open Style",
};
