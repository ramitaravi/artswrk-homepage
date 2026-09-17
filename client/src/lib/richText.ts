/**
 * Turning stored description HTML into something safe to render.
 *
 * Kept out of the component so it can be unit tested — the browser-only part
 * (DOMPurify) stays in RichText.tsx.
 */

/**
 * Legacy Bubble rich-text export isn't HTML — it's a BBCode-ish dialect
 * ([b]…[/b], [color=rgb(0,0,0)]…[/color], [li indent=0 align=left]…[/li])
 * that was leaking straight through as literal bracket text once real HTML
 * was expected instead. Real content (the new TipTap editor, or the AI job
 * parser) already emits genuine HTML with no square-bracket tags, so running
 * this first is a safe no-op for that case.
 */
export function bbcodeToHtml(input: string): string {
  let text = input;
  // Formatting tags with a direct HTML equivalent.
  text = text.replace(/\[b\]/gi, "<b>").replace(/\[\/b\]/gi, "</b>");
  text = text.replace(/\[i\]/gi, "<i>").replace(/\[\/i\]/gi, "</i>");
  text = text.replace(/\[u\]/gi, "<u>").replace(/\[\/u\]/gi, "</u>");
  text = text.replace(/\[ul\]/gi, "<ul>").replace(/\[\/ul\]/gi, "</ul>");
  text = text.replace(/\[ol\]/gi, "<ol>").replace(/\[\/ol\]/gi, "</ol>");
  // [li indent=0 align=left]…[/li] — attributes carry no useful info, drop them.
  text = text.replace(/\[li[^\]]*\]/gi, "<li>").replace(/\[\/li\]/gi, "</li>");
  // Wrapper/styling tags with no HTML equivalent worth keeping — unwrap, keep content.
  text = text.replace(/\[\/?(color|ml|size|font)[^\]]*\]/gi, "");
  // Safety net: any other bracket tag this doesn't know about yet, gone
  // rather than shown as raw markup.
  text = text.replace(/\[\/?[a-z][^\]]*\]/gi, "");
  return text;
}

const BOLD_STYLE = /font-weight\s*:\s*(bold|bolder|[6-9]00)\b/i;
const ITALIC_STYLE = /font-style\s*:\s*italic\b/i;
const UNDERLINE_STYLE = /text-decoration(?:-line)?\s*:\s*[^;]*\bunderline\b/i;

/**
 * Promote inline-styled emphasis to real tags.
 *
 * Text pasted from a website, Google Docs or Word carries emphasis as
 * `<span style="font-weight: 600">`, not `<strong>` — the Ensemble Event
 * Manager post had 15 of those and no bold tag anywhere. The renderer drops
 * `style` (so a studio's pasted fonts and colours can't fight the site's
 * typography), which silently threw the emphasis away with it. Convert first,
 * then the style attribute is safe to lose.
 *
 * Works on the tag stream rather than a DOM so it can run (and be tested)
 * outside a browser. Spans are matched in order and kept on a stack, so
 * nesting closes in the right order; anything unbalanced is left to DOMPurify.
 */
export function promoteInlineFormatting(html: string): string {
  if (!/<span/i.test(html)) return html;

  const spanTag = /<\/?span\b[^>]*>/gi;
  const stack: string[][] = [];
  let out = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = spanTag.exec(html)) !== null) {
    out += html.slice(cursor, match.index);
    cursor = match.index + match[0].length;

    if (match[0].startsWith("</")) {
      const opened = stack.pop() ?? [];
      out += opened.map((tag) => `</${tag}>`).reverse().join("") + match[0];
      continue;
    }

    const style = (/style\s*=\s*"([^"]*)"/i.exec(match[0]) ?? /style\s*=\s*'([^']*)'/i.exec(match[0]))?.[1] ?? "";
    const tags: string[] = [];
    if (BOLD_STYLE.test(style)) tags.push("strong");
    if (ITALIC_STYLE.test(style)) tags.push("em");
    if (UNDERLINE_STYLE.test(style)) tags.push("u");

    // A self-closing <span/> never gets a matching close tag, so don't stack it.
    if (!match[0].endsWith("/>")) stack.push(tags);
    out += match[0] + tags.map((tag) => `<${tag}>`).join("");
  }

  return out + html.slice(cursor);
}

/**
 * Stored description → markup ready for sanitizing.
 *
 * Plain-text descriptions (older jobs, booking notes) carry their line breaks
 * as newlines, which HTML collapses — turn them into <br> so they still read
 * as paragraphs. Real HTML is left alone.
 */
export function toRenderableHtml(input: string): string {
  const converted = promoteInlineFormatting(bbcodeToHtml(input ?? ""));
  return /<[a-z!/]/i.test(converted) ? converted : converted.replace(/\r?\n/g, "<br>");
}
