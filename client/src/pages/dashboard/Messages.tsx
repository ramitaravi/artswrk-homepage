/*
 * ARTSWRK DASHBOARD — MESSAGES
 * Real send: saves to DB + emails recipient via SendGrid.
 * Works for both clients and artists.
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search, MessageSquare, Send, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(firstName?: string | null, lastName?: string | null, name?: string | null) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (name) return name[0].toUpperCase();
  return "?";
}

function getColor(id?: string | number | null) {
  const colors = ["bg-purple-500", "bg-blue-500", "bg-green-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-red-500"];
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
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

// ── Conversation Item ──────────────────────────────────────────────────────────

function ConversationItem({ c, active, currentUserId, onClick }: {
  c: Conversation;
  active: boolean;
  currentUserId?: number;
  onClick: () => void;
}) {
  const displayName =
    c.artistFirstName && c.artistLastName
      ? `${c.artistFirstName} ${c.artistLastName}`
      : c.artistName ?? "Unknown Artist";

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
        active ? "bg-orange-50 border-r-2 border-[#F25722]" : "hover:bg-gray-50"
      }`}
    >
      <div className="relative flex-shrink-0">
        {c.artistProfilePicture ? (
          <img
            src={c.artistProfilePicture}
            alt={displayName}
            className="w-9 h-9 rounded-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className={`w-9 h-9 rounded-full ${getColor(c.artistUserId)} flex items-center justify-center text-white text-xs font-bold`}>
            {getInitials(c.artistFirstName, c.artistLastName, c.artistName)}
          </div>
        )}
        {(c.unreadCount ?? 0) > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#F25722] text-white text-[9px] font-bold flex items-center justify-center">
            {c.unreadCount}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className={`text-xs font-bold truncate ${active ? "text-[#F25722]" : "text-[#111]"}`}>
            {displayName}
          </p>
          <p className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
            {formatRelativeTime(c.lastMessageDate ?? c.bubbleCreatedAt)}
          </p>
        </div>
        {c.artistSlug && (
          <p className="text-xs text-gray-400 truncate">@{c.artistSlug}</p>
        )}
      </div>
    </button>
  );
}

// ── Chat Bubble ────────────────────────────────────────────────────────────────

function ChatBubble({ msg, isFromMe }: { msg: Message; isFromMe: boolean }) {
  if (msg.isSystem) {
    return (
      <div className="flex justify-center">
        <span className="text-[10px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }
  return (
    <div className={`flex ${isFromMe ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
        isFromMe
          ? "hirer-grad-bg text-white rounded-br-sm"
          : "bg-white border border-gray-100 text-[#111] rounded-bl-sm shadow-sm"
      }`}>
        {!isFromMe && (
          <p className="text-[10px] font-semibold mb-1 opacity-60">
            {[msg.senderFirstName, msg.senderLastName].filter(Boolean).join(" ") || msg.senderName}
          </p>
        )}
        <p className="whitespace-pre-wrap">{msg.content}</p>
        <p className={`text-[10px] mt-1 ${isFromMe ? "text-white/60" : "text-gray-400"}`}>
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [, navigate] = useLocation();

  // Get current user's DB ID
  const { data: artswrkUser } = trpc.artswrkUsers.getByEmail.useQuery(
    { email: user?.email ?? "" },
    { enabled: !!user?.email }
  );
  const myUserId = artswrkUser?.id;

  const utils = trpc.useUtils();

  const { data: conversations, isLoading: convosLoading } = trpc.messages.myConversations.useQuery({ limit: 200 });

  const { data: msgs, isLoading: msgsLoading } = trpc.messages.byConversation.useQuery(
    { conversationId: activeConvoId! },
    { enabled: activeConvoId !== null }
  );

  const sendMessage = trpc.messages.sendMessage.useMutation({
    onSuccess: () => {
      setDraft("");
      utils.messages.byConversation.invalidate({ conversationId: activeConvoId! });
      utils.messages.myConversations.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send message");
    },
  });

  // Auto-select first conversation on load
  useEffect(() => {
    if (conversations && conversations.length > 0 && activeConvoId === null) {
      setActiveConvoId(conversations[0].id);
    }
  }, [conversations, activeConvoId]);

  // Auto-scroll when messages load or new message sent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  function handleSend() {
    if (!draft.trim() || !activeConvoId) return;
    sendMessage.mutate({ conversationId: activeConvoId, content: draft.trim() });
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
    const name = [c.artistFirstName, c.artistLastName, c.artistName].filter(Boolean).join(" ").toLowerCase();
    return name.includes(q);
  });

  const activeConvo = conversations?.find((c) => c.id === activeConvoId);
  const artistDisplayName = activeConvo
    ? [activeConvo.artistFirstName, activeConvo.artistLastName].filter(Boolean).join(" ") || activeConvo.artistName || "Unknown"
    : null;

  // Message is "from me" if senderUserId matches my user ID
  const isFromMe = (msg: Message) => {
    if (myUserId) return msg.senderUserId === myUserId;
    // Fallback: if sender role is not Artist, it's the client
    if (!activeConvo) return false;
    return msg.bubbleSentById !== activeConvo.bubbleArtistId;
  };

  // ── Sidebar ────────────────────────────────────────────────────────────────

  const sidebar = (
    <div className="w-full lg:w-72 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 h-full">
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-sm font-black text-[#111] mb-3">
          Messages
          {conversations && (
            <span className="ml-2 text-gray-400 font-normal text-xs">({conversations.length})</span>
          )}
        </h1>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-xs text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {convosLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 bg-gray-100 rounded w-24" />
                <div className="h-2 bg-gray-100 rounded w-32" />
              </div>
            </div>
          ))
        ) : filteredConvos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 px-4 text-center">
            <MessageSquare size={24} className="mb-2 opacity-30" />
            <p className="text-xs">No conversations yet</p>
          </div>
        ) : (
          filteredConvos.map((c) => (
            <ConversationItem
              key={c.id}
              c={c}
              active={c.id === activeConvoId}
              currentUserId={myUserId}
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

  // ── Chat panel ────────────────────────────────────────────────────────────

  const chatPanel = (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-50 h-full">
      {activeConvo ? (
        <>
          {/* Header */}
          <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 -ml-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setMobileChatOpen(false)}
            >
              <ArrowLeft size={18} />
            </button>
            {activeConvo.artistProfilePicture ? (
              <img
                src={activeConvo.artistProfilePicture}
                alt={artistDisplayName ?? ""}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className={`w-9 h-9 rounded-full ${getColor(activeConvo.artistUserId)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                {getInitials(activeConvo.artistFirstName, activeConvo.artistLastName, activeConvo.artistName)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-bold text-[#111] truncate ${activeConvo.artistUserId ? "cursor-pointer hover:text-[#F25722] transition-colors" : ""}`}
                onClick={() => activeConvo.artistUserId && navigate(`/app/artists/${activeConvo.artistUserId}`)}
              >
                {artistDisplayName}
              </p>
              {activeConvo.artistSlug && (
                <p className="text-xs text-gray-400">@{activeConvo.artistSlug}</p>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-[#F25722] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (msgs ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                <MessageSquare size={32} className="mb-3 opacity-30" />
                <p className="text-sm">No messages yet — say hello!</p>
              </div>
            ) : (
              (msgs ?? []).map((msg) => (
                <ChatBubble key={msg.id} msg={msg} isFromMe={isFromMe(msg)} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Compose */}
          <div className="bg-white border-t border-gray-100 p-3">
            <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-[#F25722] transition-colors px-3 py-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
                rows={1}
                className="flex-1 text-sm text-[#111] placeholder-gray-400 bg-transparent resize-none focus:outline-none min-h-[20px] max-h-32"
                style={{ overflowY: draft.split("\n").length > 4 ? "auto" : "hidden" }}
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sendMessage.isPending}
                className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#F25722] text-white flex items-center justify-center hover:bg-[#d94e1d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sendMessage.isPending ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-1.5">
              Recipient will also receive an email notification
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <MessageSquare size={48} className="mb-4 opacity-20" />
          <p className="text-sm font-medium">Select a conversation</p>
          <p className="text-xs mt-1">Choose a contact from the list to start messaging</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-[calc(100vh-57px)] flex overflow-hidden">
      {/* Desktop: sidebar always visible */}
      <div className="hidden lg:flex lg:w-72 flex-shrink-0 border-r border-gray-100 h-full">
        {sidebar}
      </div>

      {/* Mobile: sidebar OR chat depending on mobileChatOpen */}
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
