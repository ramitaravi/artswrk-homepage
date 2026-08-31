/**
 * Admin-facing rich text editor (TipTap) for authoring emails and other
 * HTML content — the write-side counterpart to RichText.tsx's read-only
 * renderer. Output is sanitized with the same allowlist before it's ever
 * persisted or sent, so a compromised/careless paste can't inject scripts.
 */
import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import DOMPurify from "dompurify";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Palette, Highlighter,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon, Quote, Code,
  ListOrdered, List, IndentIncrease, IndentDecrease, Link as LinkIcon, Image as ImageIcon,
  RemoveFormatting, AlignLeft, AlignCenter, AlignRight,
} from "lucide-react";

export const RICH_TEXT_ALLOWED_TAGS = [
  "p", "br", "div", "span", "b", "strong", "i", "em", "u", "s", "strike",
  "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "blockquote", "code", "pre",
  "sup", "sub", "img",
];
export const RICH_TEXT_ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "style", "class"];

export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS,
    ALLOWED_ATTR: RICH_TEXT_ALLOWED_ATTR,
  });
}

function ToolbarButton({ onClick, active, disabled, title, children }: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? "bg-orange-50 text-[#F25722]" : "text-gray-500 hover:bg-gray-100 hover:text-[#111]"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing…",
  minHeight = 180,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      ImageExt,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      Subscript,
      Superscript,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(sanitizeRichText(editor.getHTML())),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none px-3 py-2.5",
      },
    },
  });

  // Keep editor content in sync when `value` is reset from outside (e.g. template swap)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Native window.prompt() gets silently blocked in some embedded/iframed
  // contexts (no dialog appears, prompt() just returns null) — which reads
  // as "the link button does nothing." An in-app popover always works.
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");

  if (!editor) return null;

  function openLinkPopover() {
    setLinkDraft((editor!.getAttributes("link").href as string) || "https://");
    setLinkPopoverOpen(true);
  }

  function applyLink() {
    const url = linkDraft.trim();
    if (!url) {
      editor!.chain().focus().unsetLink().run();
    } else {
      editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkPopoverOpen(false);
  }

  function removeLink() {
    editor!.chain().focus().unsetLink().run();
    setLinkPopoverOpen(false);
  }

  function setImage() {
    const url = window.prompt("Image URL");
    if (!url) return;
    editor!.chain().focus().setImage({ src: url }).run();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:border-[#F25722] transition-colors">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50/60">
        <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={14} /></ToolbarButton>
        <ToolbarButton title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={14} /></ToolbarButton>

        <span className="w-px h-4 bg-gray-200 mx-1" />

        <label className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-[#111] cursor-pointer" title="Text color">
          <Palette size={14} />
          <input
            type="color"
            className="w-0 h-0 opacity-0 absolute"
            onChange={e => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>
        <ToolbarButton title="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter size={14} /></ToolbarButton>
        <ToolbarButton title="Superscript" active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()}><SuperscriptIcon size={14} /></ToolbarButton>
        <ToolbarButton title="Subscript" active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()}><SubscriptIcon size={14} /></ToolbarButton>

        <span className="w-px h-4 bg-gray-200 mx-1" />

        <select
          onChange={e => {
            const v = e.target.value;
            if (v === "p") editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: Number(v) as 1 | 2 | 3 | 4 }).run();
            e.target.value = "";
          }}
          defaultValue=""
          className="text-xs text-gray-500 bg-transparent border-none focus:outline-none cursor-pointer px-1"
          title="Heading"
        >
          <option value="" disabled>Style</option>
          <option value="p">Paragraph</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
          <option value="4">Heading 4</option>
        </select>

        <span className="w-px h-4 bg-gray-200 mx-1" />

        <ToolbarButton title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={14} /></ToolbarButton>
        <ToolbarButton title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code size={14} /></ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></ToolbarButton>
        <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} /></ToolbarButton>
        <ToolbarButton title="Indent" onClick={() => editor.chain().focus().sinkListItem("listItem").run()}><IndentIncrease size={14} /></ToolbarButton>
        <ToolbarButton title="Outdent" onClick={() => editor.chain().focus().liftListItem("listItem").run()}><IndentDecrease size={14} /></ToolbarButton>

        <span className="w-px h-4 bg-gray-200 mx-1" />

        <ToolbarButton title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft size={14} /></ToolbarButton>
        <ToolbarButton title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter size={14} /></ToolbarButton>
        <ToolbarButton title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight size={14} /></ToolbarButton>

        <span className="w-px h-4 bg-gray-200 mx-1" />

        <span className="relative">
          <ToolbarButton title="Link" active={editor.isActive("link")} onClick={openLinkPopover}><LinkIcon size={14} /></ToolbarButton>
          {linkPopoverOpen && (
            <div className="absolute z-20 top-full left-0 mt-1 w-64 bg-white rounded-xl border border-gray-200 shadow-lg p-3 space-y-2">
              <label className="text-xs font-semibold text-gray-500 block">Link URL</label>
              <input
                type="text"
                autoFocus
                value={linkDraft}
                onChange={e => setLinkDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); applyLink(); }
                  if (e.key === "Escape") { e.preventDefault(); setLinkPopoverOpen(false); }
                }}
                placeholder="https://"
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#F25722]"
              />
              <div className="flex items-center justify-between gap-2 pt-0.5">
                {editor.isActive("link") ? (
                  <button type="button" onClick={removeLink} className="text-xs font-semibold text-red-500 hover:underline">Remove link</button>
                ) : <span />}
                <div className="flex items-center gap-2 ml-auto">
                  <button type="button" onClick={() => setLinkPopoverOpen(false)} className="text-xs font-semibold text-gray-500 hover:text-[#111]">Cancel</button>
                  <button type="button" onClick={applyLink} className="text-xs font-bold text-white bg-[#F25722] px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity">Apply</button>
                </div>
              </div>
            </div>
          )}
        </span>
        <ToolbarButton title="Image" onClick={setImage}><ImageIcon size={14} /></ToolbarButton>
        <ToolbarButton title="Clear formatting" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}><RemoveFormatting size={14} /></ToolbarButton>
      </div>

      {/* Content */}
      <div style={{ minHeight }} className="relative">
        {editor.isEmpty && (
          <p className="absolute top-2.5 left-3 text-sm text-gray-300 pointer-events-none">{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
