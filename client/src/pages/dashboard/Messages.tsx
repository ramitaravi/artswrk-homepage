/*
 * ARTSWRK DASHBOARD — MESSAGES
 */

import { useState } from "react";
import { Search, Send, MoreHorizontal } from "lucide-react";

const CONVERSATIONS = [
  { id: 1, name: "Sasha K.", initials: "SK", color: "bg-purple-500", last: "Sounds great, I'll be there Thursday!", time: "2h ago", unread: 2, job: "Thursday Versatile Instructor" },
  { id: 2, name: "Amie B.", initials: "AB", color: "bg-pink-500", last: "What time should I arrive?", time: "5h ago", unread: 1, job: "Wed PreBallet/Hip Hop" },
  { id: 3, name: "Clarissa J.", initials: "CJ", color: "bg-indigo-500", last: "I have experience with all age groups.", time: "1d ago", unread: 0, job: "Wednesday Versatile Instructor" },
  { id: 4, name: "Marlon S.", initials: "MS", color: "bg-blue-500", last: "Thank you for the opportunity!", time: "2d ago", unread: 0, job: "Saturday Sub – PreBallet" },
  { id: 5, name: "gracen n.", initials: "GN", color: "bg-green-500", last: "I'm available for Tuesday classes.", time: "3d ago", unread: 0, job: "Tuesday Jazz/Tap Instructor" },
];

const MESSAGES: Record<number, { from: "me" | "them"; text: string; time: string }[]> = {
  1: [
    { from: "them", text: "Hi! I saw your posting for the Thursday versatile instructor position. I have 5 years of experience teaching ballet, tap, and hip hop to all age groups.", time: "10:30 AM" },
    { from: "me", text: "Hi Sasha! Thanks for reaching out. Your experience sounds perfect. Are you available to start March 13th?", time: "11:15 AM" },
    { from: "them", text: "Yes, absolutely! I'm free on Thursdays and committed through May.", time: "11:22 AM" },
    { from: "me", text: "Great! I'll send you the booking confirmation shortly. The studio is at 123 Bell Blvd, Bayside.", time: "11:45 AM" },
    { from: "them", text: "Sounds great, I'll be there Thursday!", time: "12:01 PM" },
  ],
  2: [
    { from: "them", text: "Hello! I'm interested in the Wednesday PreBallet/Hip Hop position. I specialize in early childhood dance education.", time: "9:00 AM" },
    { from: "me", text: "Hi Amie! That's exactly what we need. The class runs 4:00-4:45pm every Wednesday.", time: "9:30 AM" },
    { from: "them", text: "What time should I arrive?", time: "9:35 AM" },
  ],
};

export default function Messages() {
  const [activeConvo, setActiveConvo] = useState(1);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");

  const convo = CONVERSATIONS.find(c => c.id === activeConvo);
  const messages = MESSAGES[activeConvo] || [];

  return (
    <div className="h-[calc(100vh-65px)] flex">
      {/* Sidebar */}
      <div className="w-72 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-sm font-black text-[#111] mb-3">Messages</h1>
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
          {CONVERSATIONS.filter(c => search === "" || c.name.toLowerCase().includes(search.toLowerCase())).map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveConvo(c.id)}
              className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${
                activeConvo === c.id ? "bg-orange-50" : "hover:bg-gray-50"
              }`}
            >
              <div className={`w-9 h-9 rounded-full ${c.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 relative`}>
                {c.initials}
                {c.unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#F25722] text-white text-[9px] font-bold flex items-center justify-center">
                    {c.unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className={`text-xs font-bold truncate ${activeConvo === c.id ? "text-[#F25722]" : "text-[#111]"}`}>{c.name}</p>
                  <p className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{c.time}</p>
                </div>
                <p className="text-xs text-gray-400 truncate">{c.last}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#fafafa]">
        {convo && (
          <>
            {/* Chat header */}
            <div className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full ${convo.color} flex items-center justify-center text-white text-xs font-bold`}>
                  {convo.initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#111]">{convo.name}</p>
                  <p className="text-xs text-gray-400">{convo.job}</p>
                </div>
              </div>
              <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <MoreHorizontal size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.from === "me"
                      ? "hirer-grad-bg text-white rounded-br-sm"
                      : "bg-white border border-gray-100 text-[#111] rounded-bl-sm shadow-sm"
                  }`}>
                    <p>{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${msg.from === "me" ? "text-white/60" : "text-gray-400"}`}>{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="bg-white border-t border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newMessage.trim()) setNewMessage(""); }}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-300 focus:outline-none focus:border-[#FFBC5D] transition-all"
                />
                <button
                  onClick={() => setNewMessage("")}
                  className="p-2.5 rounded-xl hirer-grad-bg text-white hover:opacity-90 transition-opacity"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
