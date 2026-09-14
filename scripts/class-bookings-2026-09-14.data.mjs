/**
 * The 2026–27 recurring class bookings sent over by Nick. One row per artist
 * per class day. Shared by create-class-bookings-2026-09-14.mjs (creates the
 * bookings) and preview-class-booking-emails-2026-09-14.mjs (drafts the emails),
 * so the bookings and the emails can't disagree.
 *
 * `end` is the season end used for the booking; it must fall AFTER the last
 * class date, or the last class is left out.
 * Class times are [start, end, name] in 24h Eastern.
 */
export const CLASS_BOOKINGS = [
  { n: 1, company: 30152, client: 1020767, artist: 781367, artistName: "Hannah Schmidt", day: "Saturday",
    first: "2026-09-19", end: "2027-06-13", rate: 50, classes: [
      ["12:45", "13:45", "Ballet Level 2 (7–12 yrs)"],
      ["13:45", "14:45", "Contemporary"],
      ["14:45", "15:45", "Ballet Level 1 (7–12 yrs)"],
    ] },
  { n: 2, company: 30152, client: 1020767, artist: 781139, artistName: "McKell Norton-Duren", day: "Tuesday",
    first: "2026-09-15", end: "2027-06-13", rate: 55, classes: [
      ["17:15", "18:15", "Jazz/Hip Hop Level 1 (5–7 yrs)"],
      ["18:15", "19:15", "Jazz/Hip Hop Level 3/4"],
      ["19:15", "20:15", "Jazz/Hip Hop Level 1 (8–12 yrs)"],
      ["20:15", "21:15", "Contemporary Teen"],
    ] },
  { n: 3, company: 30152, client: 1020767, artist: 781139, artistName: "McKell Norton-Duren", day: "Thursday",
    first: "2026-09-17", end: "2027-06-13", rate: 55, classes: [
      ["15:45", "16:30", "Grown Up & Me (18 mo–3 yrs)"],
      ["16:30", "17:30", "Jazz/Hip Hop Level 1/2 (5–7 yrs)"],
      ["17:30", "18:30", "Petite Company Ballet"],
      ["18:30", "19:30", "Petite Company Jazz"],
      ["19:30", "20:30", "Contemporary Teen"],
    ] },
  { n: 4, company: 30252, client: 1020767, artist: 780226, artistName: "Kaylee DaCosta", day: "Monday",
    first: "2026-09-14", end: "2027-06-13", rate: 50, classes: [
      ["17:15", "18:15", "Jazz/Hip Hop Level 3 (7–10 yrs)"],
      ["18:15", "19:15", "Jazz/Hip Hop Level 2 (6–8 yrs)"],
      ["19:15", "20:15", "Jazz/Hip Hop Level 1 (8–12 yrs)"],
      ["20:15", "21:15", "Contemporary (8+ yrs)"],
    ] },
  { n: 5, company: 30184, client: 1020795, artist: 781194, artistName: "Ashley Agrusa", day: "Thursday",
    first: "2026-09-17", end: "2027-06-11", rate: 60, classes: [
      ["17:30", "18:30", "Fundamental Acro (ages 7–8)"],
      ["18:30", "19:30", "Acro 2 (ages 9–11)"],
      ["19:30", "20:30", "Acro 3 (ages 12+)"],
    ] },
  { n: 6, company: 30004, client: 1020795, artist: 780202, artistName: "Marlon Santana", day: "Monday",
    first: "2026-09-14", end: "2027-06-08", rate: 80, classes: [
      ["16:30", "17:30", "Fundamental Hip Hop (6–9 yrs)"],
      ["17:30", "18:30", "Hip Hop 2 (10–12 yrs)"],
      ["18:30", "19:30", "Hip Hop 3 (13+ yrs)"],
    ] },
  { n: 7, company: 30184, client: 1020795, artist: 780202, artistName: "Marlon Santana", day: "Wednesday",
    first: "2026-09-16", end: "2027-06-10", rate: 80, classes: [
      ["16:30", "17:30", "Hip Hop 2 (11+ yrs)"],
      ["17:30", "18:30", "Fundamental Hip Hop 1 (6–8 yrs)"],
      ["18:30", "19:30", "Fundamental Hip Hop 2 (8–10 yrs)"],
    ] },
  { n: 8, company: 30906, client: 1024549, artist: 780451, artistName: "Jess Appling", day: "Wednesday",
    // RPAC = Ridgewood Performing Arts Center, owner Alexia Sheehan — confirmed by Ramita 2026-09-14.
    first: "2026-09-23", end: "2027-05-30", rate: 45,
    classes: [
      ["15:30", "16:30", "4/5 yr Combo – Ballet/Jazz/Tap"],
      ["16:30", "17:15", "8/9 Ballet"],
      ["17:15", "17:45", "9 yr Tap"],
      ["18:00", "18:45", "10/12 Tap"],
      ["18:45", "19:30", "10/12 Jazz"],
      ["19:45", "20:45", "Teen & Company Tap (12–15)"],
      ["20:45", "21:45", "Older Teen Company Tap (14–18)"],
    ] },
];

const toMin = (hm) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };

/** The day's last class end time — when the weekly reminder goes out. */
export const reminderTimeFor = (row) => row.classes.reduce((best, c) => (toMin(c[1]) > toMin(best) ? c[1] : best), "00:00");

/** Paid hours per class day: the sum of class lengths (gaps between classes aren't counted). */
export const hoursFor = (row) => row.classes.reduce((s, c) => s + toMin(c[1]) - toMin(c[0]), 0) / 60;

export const fmtTime = (hm) => { let [h, m] = hm.split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return `${h}:${String(m).padStart(2, "0")}${ap}`; };
