/*
 * ARTSWRK DASHBOARD — MESSAGES
 * Real data from Bubble via tRPC
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search, MessageSquare } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

function getArtistInitials(firstName?: string | null, lastName?: string | null, name?: string | null) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (name) return name[0].toUpperCase();
  return "?";
}

function getArtistColor(id?: string | null) {
  const colors = ["bg-purple-500", "bg-blue-500", "bg-green-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-red-500"];
  if (!id) return colors[0];
  const idx = id.charCodeAt(id.length - 1) % colors.length;
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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMessageTime(val?: Date | string | null) {
  if (!val) return "";
  const d = new Date(val);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

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
  bubbleId: string | null;
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

function ConversationItem({ c, active, onClick }: { c: Conversation; active: boolean; onClick: () => void }) {
  const artistDisplayName =
    c.artistFirstName && c.artistLastName
      ? `${c.artistFirstName} ${c.artistLastName}`
      : c.artistName ?? "Unknown Artist";

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${
        active ? "bg-orange-50" : "hover:bg-gray-50"
      }`}
    >
      <div className="relative flex-shrink-0">
        {c.artistProfilePicture ? (
          <img
            src={c.artistProfilePicture}
            alt={artistDisplayName}
            className="w-9 h-9 rounded-full object-cover border border-gray-100"
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = "none";
              const fb = el.nextElementSibling as HTMLElement;
              if (fb) fb.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className={`w-9 h-9 rounded-full ${getArtistColor(c.bubbleArtistId)} flex items-center justify-center text-white text-xs font-bold`}
          style={{ display: c.artistProfilePicture ? "none" : "flex" }}
        >
          {getArtistInitials(c.artistFirstName, c.artistLastName, c.artistName)}
        </div>
        {(c.unreadCount ?? 0) > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#F25722] text-white text-[9px] font-bold flex items-center justify-center">
            {c.unreadCount}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className={`text-xs font-bold truncate ${active ? "text-[#F25722]" : "text-[#111]"}`}>
            {artistDisplayName}
          </p>
          <p className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
            {formatRelativeTime(c.lastMessageDate ?? c.bubbleCreatedAt)}
          </p>
        </div>
        {c.artistSlug && (
          <p className="text-xs text-gray-400 truncate">@{c.artistSlug}</p>
        )}
      </div>
    </div>
  );
}

function ChatBubble({ msg, isFromClient }: { msg: Message; isFromClient: boolean }) {
  const senderName =
    msg.senderFirstName && msg.senderLastName
      ? `${msg.senderFirstName} ${msg.senderLastName}`
      : msg.senderName ?? "Unknown";

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
    <div className={`flex ${isFromClient ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
        isFromClient
          ? "hirer-grad-bg text-white rounded-br-sm"
          : "bg-white border border-gray-100 text-[#111] rounded-bl-sm shadow-sm"
      }`}>
        {!isFromClient && (
          <p className="text-[10px] font-semibold mb-1 opacity-60">{senderName}</p>
        )}
        <p>{msg.content}</p>
        <p className={`text-[10px] mt-1 ${isFromClient ? "text-white/60" : "text-gray-400"}`}>
          {formatMessageTime(msg.bubbleCreatedAt ?? msg.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const [activeConvoId, setActiveConvoId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const { data: conversations, isLoading: convosLoading } = trpc.messages.myConversations.useQuery({ limit: 200 });
  const { data: msgs, isLoading: msgsLoading } = trpc.messages.byConversation.useQuery(
    { conversationId: activeConvoId! },
    { enabled: activeConvoId !== null }
  );

  // Auto-select first conversation
  useEffect(() => {
    if (conversations && conversations.length > 0 && activeConvoId === null) {
      setActiveConvoId(conversations[0].id);
    }
  }, [conversations, activeConvoId]);

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (msgs && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs]);

  const filteredConvos = (conversations ?? []).filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = [c.artistFirstName, c.artistLastName, c.artistName].filter(Boolean).join(" ").toLowerCase();
    return name.includes(q);
  });

  const activeConvo = conversations?.find(c => c.id === activeConvoId);
  const artistDisplayName = activeConvo
    ? (activeConvo.artistFirstName && activeConvo.artistLastName
        ? `${activeConvo.artistFirstName} ${activeConvo.artistLastName}`
        : activeConvo.artistName ?? "Unknown Artist")
    : null;

  // Determine if a message was sent by the client (Nick)
  // The client's bubbleId is stored on the conversation
  const isFromClient = (msg: Message) => {
    if (!activeConvo) return false;
    // If sender is not the artist, it's the client
    return msg.bubbleSentById !== activeConvo.bubbleArtistId;
  };

  return (
    <div className="h-[calc(100vh-65px)] flex">
      {/* Sidebar */}
      <div className="w-72 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
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
              placeholder="Search conversations..."
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
              <p className="text-xs">No conversations found</p>
            </div>
          ) : (
            filteredConvos.map(c => (
              <ConversationItem
                key={c.id}
                c={c}
                active={c.id === activeConvoId}
                onClick={() => setActiveConvoId(c.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#fafafa]">
        {activeConvo ? (
          <>
            {/* Chat header */}
            <div className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center gap-3">
              <div className="relative flex-shrink-0">
                {activeConvo.artistProfilePicture ? (
                  <img
                    src={activeConvo.artistProfilePicture}
                    alt={artistDisplayName ?? ""}
                    className="w-9 h-9 rounded-full object-cover border border-gray-100"
                    onError={(e) => {
                      const el = e.currentTarget;
                      el.style.display = "none";
                      const fb = el.nextElementSibling as HTMLElement;
                      if (fb) fb.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className={`w-9 h-9 rounded-full ${getArtistColor(activeConvo.bubbleArtistId)} flex items-center justify-center text-white text-xs font-bold`}
                  style={{ display: activeConvo.artistProfilePicture ? "none" : "flex" }}
                >
                  {getArtistInitials(activeConvo.artistFirstName, activeConvo.artistLastName, activeConvo.artistName)}
                </div>
              </div>
              <div>
                <p
                  className={`text-sm font-bold text-[#111] ${activeConvo.artistUserId ? 'cursor-pointer hover:text-[#F25722] transition-colors' : ''}`}
                  onClick={() => activeConvo.artistUserId && navigate(`/dashboard/artists/${activeConvo.artistUserId}`)}
                >{artistDisplayName}</p>
                {activeConvo.artistSlug && (
                  <p className="text-xs text-gray-400">@{activeConvo.artistSlug}</p>
                )}
              </div>
              <div className="ml-auto text-xs text-gray-400">
                {msgs ? `${msgs.length} messages` : ""}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {msgsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#F25722] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (msgs ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <MessageSquare size={32} className="mb-3 opacity-30" />
                  <p className="text-sm">No messages yet</p>
                </div>
              ) : (
                (msgs ?? []).map(msg => (
                  <ChatBubble key={msg.id} msg={msg} isFromClient={isFromClient(msg)} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Read-only notice */}
            <div className="bg-white border-t border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-400 text-center">
                This is a read-only view of your Artswrk message history. Reply to artists on{" "}
                <a href="https://artswrk.com" target="_blank" rel="noopener noreferrer" className="text-[#F25722] hover:underline">
                  artswrk.com
                </a>
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="text-xs mt-1">Choose an artist from the list to view your messages</p>
          </div>
        )}
      </div>
    </div>
  );
}
