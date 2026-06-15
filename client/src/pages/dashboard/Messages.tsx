/*
 * ARTSWRK DASHBOARD — MESSAGES
 * Split-panel layout: conversation list (left) + thread view (right).
 * Works for both artists (sees clients) and clients (sees artists).
 */

import React, { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Search, MessageSquare, Send, ArrowLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

// ── BBCode / URL parser ────────────────────────────────────────────────────────

// Converts Bubble's BBCode markup and bare URLs into React nodes.
// Handles: [url=URL][b]text[/b][/url], [b]...[/b], bare https:// URLs, newlines.
function parseMessageContent(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Combined regex: BBCode url tag, bold tag, bare URL, or newline
  const pattern = /\[url=([^\]]+)\]([\s\S]*?)\[\/url\]|\[b\]([\s\S]*?)\[\/b\]|(https?:\/\/[^\s\[\]]+)|\n/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    // Push any plain text before this match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      // [url=URL]inner[/url] — strip inner BBCode tags for display text
      const href = match[1];
      const innerText = match[2].replace(/\[\/?(b|i|u)\]/g, "").trim();
      nodes.push(
        <a key={key++} href={href} target="_blank" rel="noopener noreferrer"
          className="underline underline-offset-2 font-semibold break-all opacity-90 hover:opacity-100">
          {innerText || href}
        </a>
      );
    } else if (match[3] !== undefined) {
      // [b]...[/b]
      nodes.push(<strong key={key++}>{match[3]}</strong>);
    } else if (match[4] !== undefined) {
      // bare URL
      nodes.push(
        <a key={key++} href={match[4]} target="_blank" rel="noopener noreferrer"
          className="underline underline-offset-2 break-all opacity-90 hover:opacity-100">
          {match[4]}
        </a>
      );
    } else {
      // newline
      nodes.push(<br key={key++} />);
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(firstName?: string | null, lastName?: string | null, name?: string | null) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (name) return name[0].toUpperCase();
  return "?";
}

function getColor(id?: string | number | null) {
  const colors = [
    "bg-pink-500", "bg-blue-500", "bg-purple-500", "bg-green-500",
    "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-rose-500",
  ];
  const str = String(id ?? "");
  if (!str) return colors[0];
  const idx = str.charCodeAt(str.length - 1) % colors.length;
  return colors[idx];
}

function formatRelativeTime(val?: Date | string | null) {
  if (!val) return "";
  const d = new Date(val);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatMessageTime(val?: Date | string | null) {
  if (!val) return "";
  const d = new Date(val);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Conversation = {
  id: number;
  bubbleId: string | null;
  clientUserId: number | null;
  bubbleClientId: string | null;
  artistUserId: number | null;
  bubbleArtistId: string | null;
  lastMessageDate: Date | null;
  unreadCount: number | null;
  createdAt: Date | null;
  bubbleCreatedAt: Date | null;
  artistFirstName: string | null;
  artistLastName: string | null;
  artistName: string | null;
  artistProfilePicture: string | null;
  artistSlug: string | null;
  clientCompanyName?: string | null;
  lastMessageContent?: string | null;
};

type Message = {
  id: number;
  conversationId: number | null;
  senderUserId: number | null;
  bubbleSentById: string | null;
  content: string | null;
  isSystem: boolean | null;
  createdAt: Date | null;
  bubbleCreatedAt: Date | null;
  senderFirstName: string | null;
  senderLastName: string | null;
  senderName: string | null;
  senderProfilePicture: string | null;
  senderUserRole: string | null;
};

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({
  src, firstName, lastName, name, id, size = "md",
}: {
  src?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  id?: string | number | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-11 h-11 text-sm" : "w-10 h-10 text-xs";
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full ${getColor(id)} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {getInitials(firstName, lastName, name)}
    </div>
  );
}

// ── Conversation Row ──────────────────────────────────────────────────────────

function ConversationRow({ c, active, onClick }: {
  c: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const displayName =
    c.artistFirstName && c.artistLastName
      ? `${c.artistFirstName} ${c.artistLastName}`
      : c.clientCompanyName ?? c.artistName ?? "Unknown";

  const hasUnread = (c.unreadCount ?? 0) > 0;
  const timeStr = formatRelativeTime(c.lastMessageDate ?? c.bubbleCreatedAt);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all group ${
        active
          ? "bg-pink-50 border-r-2 border-[#ec008c]"
          : "hover:bg-gray-50 border-r-2 border-transparent"
      }`}
    >
      <div className="relative flex-shrink-0">
        <Avatar
          src={c.artistProfilePicture}
          firstName={c.artistFirstName}
          lastName={c.artistLastName}
          name={displayName}
          id={c.artistUserId ?? c.clientUserId}
          size="md"
        />
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#ec008c] text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
            {c.unreadCount}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <p className={`text-sm truncate ${hasUnread ? "font-bold text-[#111]" : active ? "font-semibold text-[#ec008c]" : "font-semibold text-[#111]"}`}>
            {displayName}
          </p>
          <span className="text-[11px] text-gray-400 flex-shrink-0 whitespace-nowrap">{timeStr}</span>
        </div>
        {c.lastMessageContent ? (
          <p className={`text-xs truncate leading-snug ${hasUnread ? "text-[#111]" : "text-gray-400"}`}>
            {c.lastMessageContent}
          </p>
        ) : (
          <p className="text-xs text-gray-300 italic">No messages yet</p>
        )}
      </div>

      <ChevronRight size={14} className={`flex-shrink-0 transition-colors ${active ? "text-[#ec008c]" : "text-gray-200 group-hover:text-gray-400"}`} />
    </button>
  );
}

// ── Chat Bubble ────────────────────────────────────────────────────────────────

function ChatBubble({ msg, isFromMe }: { msg: Message; isFromMe: boolean }) {
  if (msg.isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-[10px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }
  return (
    <div className={`flex ${isFromMe ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
        isFromMe
          ? "bg-[#ec008c] text-white rounded-br-sm"
          : "bg-white border border-gray-100 text-[#111] rounded-bl-sm shadow-sm"
      }`}>
        {!isFromMe && (
          <p className={`text-[10px] font-semibold mb-1 ${isFromMe ? "text-white/70" : "text-gray-400"}`}>
            {[msg.senderFirstName, msg.senderLastName].filter(Boolean).join(" ") || msg.senderName}
          </p>
        )}
        <p className="break-words">{parseMessageContent(msg.content ?? "")}</p>
        <p className={`text-[10px] mt-1.5 ${isFromMe ? "text-white/60" : "text-gray-400"}`}>
          {formatMessageTime(msg.bubbleCreatedAt ?? msg.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Messages() {
  const { user } = useAuth();
  const [activeConvoId, setActiveConvoId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [optimisticMsgs, setOptimisticMsgs] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unreadDividerRef = useRef<HTMLDivElement>(null);
  // Capture unread count at the moment the conversation is opened (before markAsRead clears it)
  const [entryUnreadCount, setEntryUnreadCount] = useState(0);
  const [showUnreadDivider, setShowUnreadDivider] = useState(false);
  const hasScrolledToUnread = useRef(false);
  const [, navigate] = useLocation();

  const { data: artswrkUser } = trpc.artswrkUsers.getByEmail.useQuery(
    { email: user?.email ?? "" },
    { enabled: !!user?.email }
  );
  const myUserId = artswrkUser?.id;
  const isArtist = artswrkUser?.userRole === "Artist";

  const utils = trpc.useUtils();

  const { data: conversations, isLoading: convosLoading } = trpc.messages.myConversations.useQuery({ limit: 200 });

  const { data: msgs, isLoading: msgsLoading } = trpc.messages.byConversation.useQuery(
    { conversationId: activeConvoId! },
    { enabled: activeConvoId !== null }
  );

  const markAsRead = trpc.messages.markAsRead.useMutation({
    onSuccess: () => {
      // Update the conversation list so the unread badge disappears immediately
      utils.messages.myConversations.invalidate();
      utils.messages.myStats.invalidate();
    },
  });

  const sendMessage = trpc.messages.sendMessage.useMutation({
    onMutate: ({ content, conversationId }) => {
      const optimistic: Message = {
        id: -Date.now(),
        conversationId,
        senderUserId: myUserId ?? null,
        bubbleSentById: null,
        content,
        isSystem: false,
        createdAt: new Date(),
        bubbleCreatedAt: null,
        senderFirstName: artswrkUser?.firstName ?? null,
        senderLastName: artswrkUser?.lastName ?? null,
        senderName: artswrkUser?.name ?? null,
        senderProfilePicture: artswrkUser?.profilePicture ?? null,
        senderUserRole: artswrkUser?.userRole ?? null,
      };
      setOptimisticMsgs((prev) => [...prev, optimistic]);
      setDraft("");
    },
    onSuccess: () => {
      setOptimisticMsgs([]);
      utils.messages.byConversation.invalidate({ conversationId: activeConvoId! });
      utils.messages.myConversations.invalidate();
    },
    onError: (err) => {
      setOptimisticMsgs([]);
      toast.error(err.message || "Failed to send message");
    },
  });

  useEffect(() => {
    if (conversations && conversations.length > 0 && activeConvoId === null) {
      setActiveConvoId(conversations[0].id);
    }
  }, [conversations, activeConvoId]);

  useEffect(() => {
    setOptimisticMsgs([]);
  }, [activeConvoId]);

  // When switching conversations: capture unread count before markAsRead clears it, reset divider state
  useEffect(() => {
    if (!activeConvoId) return;
    const convo = conversations?.find((c) => c.id === activeConvoId);
    const count = convo?.unreadCount ?? 0;
    setEntryUnreadCount(count);
    setShowUnreadDivider(count > 0);
    hasScrolledToUnread.current = false;
  }, [activeConvoId]);

  // Mark conversation as read when it's opened
  useEffect(() => {
    if (!activeConvoId || !conversations) return;
    const convo = conversations.find((c) => c.id === activeConvoId);
    if (convo && (convo.unreadCount ?? 0) > 0) {
      markAsRead.mutate({ conversationId: activeConvoId });
    }
  }, [activeConvoId]);

  // Scroll: jump to first unread on initial load, then always follow new messages to bottom
  useEffect(() => {
    if (!msgs) return;
    if (!hasScrolledToUnread.current) {
      hasScrolledToUnread.current = true;
      if (entryUnreadCount > 0 && unreadDividerRef.current) {
        unreadDividerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        // Fade out the divider after 2.5 s
        const t = setTimeout(() => setShowUnreadDivider(false), 2500);
        return () => clearTimeout(t);
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      // Subsequent updates (new sent/received messages) → always go to bottom
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs, optimisticMsgs]);

  function handleSend() {
    const text = draft.trim();
    if (!text || !activeConvoId) return;
    sendMessage.mutate({ conversationId: activeConvoId, content: text });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const filteredConvos = (conversations ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = [c.artistFirstName, c.artistLastName, c.clientCompanyName, c.artistName].filter(Boolean).join(" ").toLowerCase();
    return name.includes(q);
  });

  const activeConvo = conversations?.find((c) => c.id === activeConvoId);
  const otherPartyName = activeConvo
    ? [activeConvo.artistFirstName, activeConvo.artistLastName].filter(Boolean).join(" ") || (activeConvo as any).clientCompanyName || activeConvo.artistName || "Unknown"
    : null;

  const isFromMe = (msg: Message) => {
    if (myUserId) return msg.senderUserId === myUserId;
    if (!activeConvo) return false;
    return msg.bubbleSentById !== activeConvo.bubbleArtistId;
  };

  // ── Skeleton rows ────────────────────────────────────────────────────────────

  const skeletonRows = [...Array(6)].map((_, i) => (
    <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-100 rounded w-28" />
        <div className="h-2.5 bg-gray-100 rounded w-40" />
      </div>
    </div>
  ));

  // ── Sidebar ──────────────────────────────────────────────────────────────────

  const sidebar = (
    <div className="w-full flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base font-black text-[#111]">
            Messages
            {conversations && conversations.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">({conversations.length})</span>
            )}
          </h1>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-xs text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#ff7171] transition-all bg-gray-50"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {convosLoading ? skeletonRows
          : filteredConvos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 px-6 text-center">
              <MessageSquare size={32} className="mb-3 opacity-20" />
              <p className="text-sm font-semibold text-gray-600 mb-1">
                {search ? "No results" : "No conversations yet"}
              </p>
              {!search && (
                isArtist ? (
                  <>
                    <p className="text-xs mb-4">Apply to jobs to start chatting with hirers.</p>
                    <Link href="/app/jobs" className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity">
                      Browse jobs →
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-xs mb-4">Hire an artist to start a conversation.</p>
                    <Link href="/app/artists" className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity">
                      Browse artists →
                    </Link>
                  </>
                )
              )}
            </div>
          ) : (
            filteredConvos.map((c) => (
              <ConversationRow
                key={c.id}
                c={c}
                active={c.id === activeConvoId}
                onClick={() => {
                  setActiveConvoId(c.id);
                  setMobileChatOpen(true);
                }}
              />
            ))
          )}
      </div>
    </div>
  );

  // ── Chat panel ───────────────────────────────────────────────────────────────

  const allMessages = [...(msgs ?? []), ...optimisticMsgs];
  // Index in allMessages where unread messages start (based on count captured at open time)
  const firstUnreadIndex = entryUnreadCount > 0 && msgs
    ? Math.max(0, msgs.length - entryUnreadCount)
    : -1;

  const chatPanel = (
    <div className="flex-1 flex flex-col min-w-0 bg-[#f7f7f8] h-full">
      {activeConvo ? (
        <>
          {/* Chat header */}
          <div className="bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
            <button
              className="lg:hidden p-1.5 -ml-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setMobileChatOpen(false)}
            >
              <ArrowLeft size={18} />
            </button>
            <Avatar
              src={activeConvo.artistProfilePicture}
              firstName={activeConvo.artistFirstName}
              lastName={activeConvo.artistLastName}
              name={otherPartyName}
              id={activeConvo.artistUserId ?? activeConvo.clientUserId}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-bold text-[#111] truncate ${!isArtist && activeConvo.artistUserId ? "cursor-pointer hover:text-[#ec008c] transition-colors" : ""}`}
                onClick={() => !isArtist && activeConvo.artistUserId && navigate(`/app/artists/${activeConvo.artistUserId}`)}
              >
                {otherPartyName}
              </p>
              {activeConvo.artistSlug && (
                <p className="text-[11px] text-gray-400">@{activeConvo.artistSlug}</p>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
            {msgsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border-2 border-[#ec008c] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : allMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                <MessageSquare size={36} className="mb-3 opacity-20" />
                <p className="text-sm">No messages yet — say hello!</p>
              </div>
            ) : (
              allMessages.map((msg, i) => (
                <React.Fragment key={msg.id}>
                  {i === firstUnreadIndex && (
                    <div
                      ref={unreadDividerRef}
                      className={`flex items-center gap-2 py-1 transition-opacity duration-1000 ${showUnreadDivider ? "opacity-100" : "opacity-0"}`}
                    >
                      <div className="flex-1 h-px bg-[#ec008c]/40" />
                      <span className="text-[10px] font-semibold text-[#ec008c] uppercase tracking-wider px-2 whitespace-nowrap">
                        {entryUnreadCount === 1 ? "1 new message" : `${entryUnreadCount} new messages`}
                      </span>
                      <div className="flex-1 h-px bg-[#ec008c]/40" />
                    </div>
                  )}
                  <ChatBubble msg={msg} isFromMe={isFromMe(msg)} />
                </React.Fragment>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Compose */}
          <div className="bg-white border-t border-gray-100 p-3">
            <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-[#ec008c] focus-within:bg-white transition-all px-3 py-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a message… (Enter to send)"
                rows={1}
                className="flex-1 text-sm text-[#111] placeholder-gray-400 bg-transparent resize-none focus:outline-none min-h-[20px] max-h-32"
                style={{ overflowY: draft.split("\n").length > 4 ? "auto" : "hidden" }}
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sendMessage.isPending}
                className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#ec008c] text-white flex items-center justify-center hover:bg-[#c40075] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {sendMessage.isPending ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-1.5">
              Shift+Enter for new line
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <MessageSquare size={48} className="mb-4 opacity-15" />
          <p className="text-sm font-semibold text-gray-500">Select a conversation</p>
          <p className="text-xs mt-1 text-gray-400">Choose from your messages on the left</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-[calc(100vh-57px)] flex overflow-hidden">
      {/* Desktop: fixed-width sidebar */}
      <div className="hidden lg:flex lg:w-80 flex-shrink-0 border-r border-gray-100 h-full overflow-hidden">
        {sidebar}
      </div>

      {/* Mobile: show list OR chat */}
      {!mobileChatOpen ? (
        <div className="lg:hidden flex-1 h-full overflow-hidden">{sidebar}</div>
      ) : (
        <div className="lg:hidden flex-1 h-full overflow-hidden">{chatPanel}</div>
      )}

      {/* Desktop chat panel */}
      <div className="hidden lg:flex flex-1 h-full overflow-hidden">{chatPanel}</div>
    </div>
  );
}
