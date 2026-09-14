/**
 * Artist/service types are matched against job type ids. Some stored values are
 * display names instead, which never match — splitTypeValues decides which is
 * which so the job feed can resolve names before filtering.
 */
import { describe, it, expect } from "vitest";
import { splitTypeValues } from "./db";

describe("splitTypeValues", () => {
  it("treats Bubble ids as ids", () => {
    expect(splitTypeValues(["1652795268178x593637050563690500"])).toEqual({
      ids: ["1652795268178x593637050563690500"],
      names: [],
    });
  });

  it("treats numeric ids from new-site types as ids", () => {
    expect(splitTypeValues(["42"])).toEqual({ ids: ["42"], names: [] });
  });

  it("treats display names as names", () => {
    expect(splitTypeValues(["Dance Educator", "Side Jobs"])).toEqual({
      ids: [],
      names: ["Dance Educator", "Side Jobs"],
    });
  });

  it("splits a mix and ignores blanks", () => {
    expect(splitTypeValues(["1667426441226x668855578210537000", " Dance Educator ", "", "  "])).toEqual({
      ids: ["1667426441226x668855578210537000"],
      names: ["Dance Educator"],
    });
  });
});
