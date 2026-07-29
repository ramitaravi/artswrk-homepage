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

export default function RichText({ html, className = "" }: RichTextProps) {
  const clean = DOMPurify.sanitize(html, {
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
