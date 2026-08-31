/**
 * Renders job/profile description HTML (authored via Bubble's rich text editor,
 * or the AI job parser) safely. Descriptions are sanitized client-side before
 * being injected — hirer-authored HTML should never run scripts or handlers.
 */
import DOMPurify from "dompurify";

interface RichTextProps {
  html: string;
  className?: string;
}

/**
 * Legacy Bubble rich-text export isn't HTML — it's a BBCode-ish dialect
 * ([b]…[/b], [color=rgb(0,0,0)]…[/color], [li indent=0 align=left]…[/li])
 * that was leaking straight through as literal bracket text once real HTML
 * was expected instead. Real content (the new TipTap editor, or the AI job
 * parser) already emits genuine HTML with no square-bracket tags, so running
 * this first is a safe no-op for that case.
 */
function bbcodeToHtml(input: string): string {
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

export default function RichText({ html, className = "" }: RichTextProps) {
  const clean = DOMPurify.sanitize(bbcodeToHtml(html), {
    ALLOWED_TAGS: [
      "p", "br", "div", "span", "b", "strong", "i", "em", "u", "s", "strike",
      "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "blockquote",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });

  return (
    <div
      className={`prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
