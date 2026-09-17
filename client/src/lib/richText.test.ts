/**
 * Job descriptions are pasted from websites, Google Docs and Word, where bold
 * is an inline style rather than a tag. The renderer strips `style`, so without
 * promotion every bold heading in a PRO post rendered as plain text.
 */
import { describe, it, expect } from "vitest";
import { bbcodeToHtml, promoteInlineFormatting, toRenderableHtml } from "./richText";

describe("promoteInlineFormatting", () => {
  it("turns a font-weight span into a real strong tag", () => {
    // The exact shape stored by the Ensemble Event Manager post.
    const html = '<span style="font-weight: 600; line-height: inherit;">Key Responsibilities</span>';
    expect(promoteInlineFormatting(html)).toBe(
      '<span style="font-weight: 600; line-height: inherit;"><strong>Key Responsibilities</strong></span>'
    );
  });

  it("accepts every way bold is written", () => {
    for (const weight of ["bold", "bolder", "600", "700", "900"]) {
      expect(promoteInlineFormatting(`<span style="font-weight: ${weight}">x</span>`)).toContain("<strong>x</strong>");
    }
  });

  it("leaves normal-weight text alone", () => {
    for (const weight of ["400", "500", "normal", "lighter"]) {
      expect(promoteInlineFormatting(`<span style="font-weight: ${weight}">x</span>`)).not.toContain("<strong>");
    }
  });

  it("handles italic and underline", () => {
    expect(promoteInlineFormatting('<span style="font-style: italic">x</span>')).toContain("<em>x</em>");
    expect(promoteInlineFormatting('<span style="text-decoration: underline">x</span>')).toContain("<u>x</u>");
    expect(promoteInlineFormatting('<span style="text-decoration-line: underline">x</span>')).toContain("<u>x</u>");
  });

  it("closes nested spans in the right order", () => {
    const html = '<span style="font-weight:700">bold <span style="font-style:italic">and italic</span> again</span>';
    const out = promoteInlineFormatting(html);
    expect(out).toContain("<strong>bold <span style=\"font-style:italic\"><em>and italic</em></span> again</strong>");
    expect(out.indexOf("</em>")).toBeLessThan(out.indexOf("</strong>"));
  });

  it("stacks bold and italic on one span", () => {
    const out = promoteInlineFormatting('<span style="font-weight:700;font-style:italic">x</span>');
    expect(out).toContain("<strong><em>x</em></strong>");
  });

  it("passes through content with no spans untouched", () => {
    const html = "<p>Plain <strong>already bold</strong></p><ul><li>one</li></ul>";
    expect(promoteInlineFormatting(html)).toBe(html);
  });

  it("does not drop text around an unmatched closing span", () => {
    expect(promoteInlineFormatting("before</span>after")).toBe("before</span>after");
  });
});

describe("toRenderableHtml", () => {
  it("keeps list markup so bullets can render", () => {
    expect(toRenderableHtml("<ul><li>one</li><li>two</li></ul>")).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("turns plain-text newlines into line breaks", () => {
    expect(toRenderableHtml("line one\nline two")).toBe("line one<br>line two");
  });

  it("does not add line breaks to real HTML", () => {
    expect(toRenderableHtml("<p>one</p>\n<p>two</p>")).toBe("<p>one</p>\n<p>two</p>");
  });

  it("still converts legacy Bubble bracket markup", () => {
    expect(bbcodeToHtml("[b]Hi[/b]")).toBe("<b>Hi</b>");
    expect(toRenderableHtml("[li indent=0]one[/li]")).toBe("<li>one</li>");
  });

  it("handles an empty description", () => {
    expect(toRenderableHtml("")).toBe("");
  });
});
