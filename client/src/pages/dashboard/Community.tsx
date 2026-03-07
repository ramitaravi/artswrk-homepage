/*
 * ARTSWRK DASHBOARD — COMMUNITY (Premium)
 */

import { useState } from "react";
import { Heart, MessageSquare, Share2, Plus, Crown, TrendingUp, Pin } from "lucide-react";

const POSTS = [
  {
    id: 1, author: "Phyllis R.", initials: "PR", color: "bg-orange-500", time: "2h ago", pinned: true,
    content: "Just hired my 3rd instructor through Artswrk this season! The quality of applicants has been incredible. Highly recommend posting your recurring class openings here.",
    likes: 24, comments: 8, tag: "Tip",
  },
  {
    id: 2, author: "Maria T.", initials: "MT", color: "bg-blue-500", time: "5h ago", pinned: false,
    content: "Question for the group: how do you handle last-minute sub requests? I usually need someone within 24 hours and it's always stressful. Any tips?",
    likes: 12, comments: 15, tag: "Question",
  },
  {
    id: 3, author: "Dance Studio NYC", initials: "DS", color: "bg-purple-500", time: "1d ago", pinned: false,
    content: "Pro tip: include the LIRR/subway directions in your job description. We've seen a 40% increase in applicants since we started doing this. Artists appreciate knowing the commute!",
    likes: 47, comments: 11, tag: "Tip",
  },
  {
    id: 4, author: "Chicago Arts Collective", initials: "CA", color: "bg-green-500", time: "2d ago", pinned: false,
    content: "We just launched our Spring recital season and already have all 8 instructor slots filled through Artswrk. This platform has been a game changer for our studio.",
    likes: 63, comments: 19, tag: "Success Story",
  },
];

const TAG_COLORS: Record<string, string> = {
  "Tip": "bg-blue-50 text-blue-600",
  "Question": "bg-amber-50 text-amber-600",
  "Success Story": "bg-green-50 text-green-600",
};

export default function Community() {
  const [liked, setLiked] = useState<Set<number>>(new Set());

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-[#111]">Community</h1>
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">
              <Crown size={10} /> Premium
            </span>
          </div>
          <p className="text-gray-500 text-sm">Connect with other hirers and share insights</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity">
          <Plus size={15} /> New Post
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-[#111]">1,240</p>
          <p className="text-xs text-gray-400 mt-1">Members</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-[#111]">89</p>
          <p className="text-xs text-gray-400 mt-1">Posts this week</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
          <TrendingUp size={16} className="mx-auto mb-1 text-[#F25722]" />
          <p className="text-xs text-gray-400">Trending: Sub coverage tips</p>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {POSTS.map((post) => (
          <div key={post.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${post.pinned ? "border-orange-200" : "border-gray-100"}`}>
            {post.pinned && (
              <div className="flex items-center gap-1 text-xs font-semibold text-[#F25722] mb-3">
                <Pin size={11} /> Pinned
              </div>
            )}
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-9 h-9 rounded-full ${post.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                {post.initials}
              </div>
              <div>
                <p className="text-sm font-bold text-[#111]">{post.author}</p>
                <p className="text-xs text-gray-400">{post.time}</p>
              </div>
              <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${TAG_COLORS[post.tag]}`}>
                {post.tag}
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">{post.content}</p>
            <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => setLiked(prev => { const n = new Set(prev); n.has(post.id) ? n.delete(post.id) : n.add(post.id); return n; })}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#F25722] transition-colors"
              >
                <Heart size={14} className={liked.has(post.id) ? "fill-[#F25722] text-[#F25722]" : ""} />
                {post.likes + (liked.has(post.id) ? 1 : 0)}
              </button>
              <button className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#F25722] transition-colors">
                <MessageSquare size={14} /> {post.comments}
              </button>
              <button className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#F25722] transition-colors ml-auto">
                <Share2 size={14} /> Share
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
