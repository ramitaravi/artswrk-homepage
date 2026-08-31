import { describe, expect, it } from "vitest";
import { HOME_FAQS } from "../client/src/data/homepageFaqs";
import {
  buildHomepageAuthDestination,
  HOMEPAGE_JOB_DRAFT_KEY,
} from "../client/src/lib/homepageSignup";

describe("homepage signup handoff", () => {
  it("routes an existing hirer to a prefilled login and returns to post a job", () => {
    expect(buildHomepageAuthDestination({
      email: "  Client@Example.COM ",
      role: "client",
      exists: true,
    })).toBe("/login?email=client%40example.com&role=client&next=%2Fpost-job");
  });

  it("routes a new hirer to a prefilled client registration and returns to post a job", () => {
    expect(buildHomepageAuthDestination({
      email: "new@example.com",
      role: "client",
      exists: false,
    })).toBe("/join?email=new%40example.com&role=client&next=%2Fpost-job");
    expect(HOMEPAGE_JOB_DRAFT_KEY).toBe("postJobPrefill");
  });

  it("routes artists through the same lookup without sending them to the job-post flow", () => {
    expect(buildHomepageAuthDestination({
      email: "artist@example.com",
      role: "artist",
      exists: true,
    })).toBe("/login?email=artist%40example.com&role=artist&next=%2Fapp");
  });
});

describe("homepage audience FAQs", () => {
  it("contains the complete supplied FAQ sets for hirers and artists", () => {
    expect(HOME_FAQS.hirers.map(item => item.q)).toEqual([
      "Are there fees to hire on Artswrk?",
      "How do payments work?",
      "Do I have to provide tax documentation?",
      "Who are the Artswrk artists?",
    ]);
    expect(HOME_FAQS.artists.map(item => item.q)).toEqual([
      "How do I get booked on Artswrk?",
      "Why do I need to share my rates, location, etc.?",
      "How do payments work?",
      "How do taxes work?",
      "Who are the Artswrk clients?",
    ]);
  });
});
