export type CompetitionLogo = {
  name: string;
  src: string;
  surface: "light" | "dark";
  sizing?: "wide" | "standard" | "compact";
};

export const COMPETITION_LOGOS: CompetitionLogo[] = [
  {
    name: "Accelerate Dance Experience",
    src: "/manus-storage/accelerate-dance-experience_bf858aab.png",
    surface: "light",
    sizing: "wide",
  },
  {
    name: "Thunderstruck Dance Competition",
    src: "/manus-storage/thunderstruck-dance-competition_ee0dcba3.webp",
    surface: "dark",
    sizing: "wide",
  },
  {
    name: "Storm Dance Challenge",
    src: "/manus-storage/storm-dance-challenge_5cc3f094.webp",
    surface: "dark",
    sizing: "standard",
  },
  {
    name: "DanceONE",
    src: "/manus-storage/danceone_e7264985.png",
    surface: "light",
    sizing: "wide",
  },
  {
    name: "REVEL Dance Convention",
    src: "/manus-storage/revel_aaaad0b2.png",
    surface: "light",
    sizing: "compact",
  },
  {
    name: "Imagine National Dance Challenge",
    src: "/manus-storage/imagine-national-dance-challenge_dbc06acd.png",
    surface: "light",
    sizing: "compact",
  },
  {
    name: "American Dance Awards",
    src: "/manus-storage/american-dance-awards_ce655a4c.png",
    surface: "light",
    sizing: "wide",
  },
  {
    name: "Journey Dance Competition",
    src: "/manus-storage/journey-dance-competition_b2e43b3d.png",
    surface: "light",
    sizing: "standard",
  },
  {
    name: "Elevation on Tour",
    src: "/manus-storage/elevation-on-tour_71abce14.png",
    surface: "light",
    sizing: "compact",
  },
  {
    name: "On Stage America",
    src: "/manus-storage/on-stage-america_a69d3f2e.png",
    surface: "light",
    sizing: "standard",
  },
];
