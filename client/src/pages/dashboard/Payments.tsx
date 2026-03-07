/*
 * ARTSWRK DASHBOARD — PAYMENTS & WALLET
 */

import { useState } from "react";
import { DollarSign, Send, Download, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, CreditCard, Plus } from "lucide-react";

const TRANSACTIONS = [
  { id: 1, type: "out", artist: "Sasha K.", job: "Thursday Versatile Instructor", date: "Mar 6, 2025", amount: "-$146.25", status: "completed" },
  { id: 2, type: "out", artist: "Amie B.", job: "Wed PreBallet/Hip Hop", date: "Mar 5, 2025", amount: "-$37.50", status: "completed" },
  { id: 3, type: "out", artist: "Clarissa J.", job: "Wednesday Versatile Instructor", date: "Mar 5, 2025", amount: "-$180.00", status: "pending" },
  { id: 4, type: "out", artist: "Marlon S.", job: "Saturday Sub – PreBallet", date: "Mar 1, 2025", amount: "-$80.00", status: "completed" },
  { id: 5, type: "in", artist: "Artswrk", job: "Wallet Top-Up", date: "Feb 28, 2025", amount: "+$500.00", status: "completed" },
  { id: 6, type: "out", artist: "gracen n.", job: "Tuesday Jazz/Tap Instructor", date: "Feb 25, 2025", amount: "-$90.00", status: "completed" },
  { id: 7, type: "out", artist: "Jesse B.", job: "Hip Hop Sub Class", date: "Feb 20, 2025", amount: "-$55.00", status: "completed" },
  { id: 8, type: "in", artist: "Artswrk", job: "Wallet Top-Up", date: "Feb 15, 2025", amount: "+$300.00", status: "completed" },
];

export default function Payments() {
  const [showSendForm, setShowSendForm] = useState(false);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-black text-[#111]">Payments & Wallet</h1>
        <p className="text-gray-500 text-sm mt-1">Manage payments to your artists</p>
      </div>

      {/* Wallet card */}
      <div className="hirer-grad-bg rounded-2xl p-6 mb-7 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/4 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 translate-y-1/4 -translate-x-1/4" />
        <div className="relative">
          <p className="text-sm font-semibold text-white/70 mb-1">Wallet Balance</p>
          <p className="text-4xl font-black mb-1">$211.25</p>
          <p className="text-sm text-white/60">FieldCrest School of Performing Arts</p>
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={() => setShowSendForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#F25722] text-xs font-bold hover:bg-white/90 transition-colors"
            >
              <Send size={13} /> Send Payment
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 text-white text-xs font-bold hover:bg-white/30 transition-colors">
              <Plus size={13} /> Add Funds
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 text-white text-xs font-bold hover:bg-white/30 transition-colors">
              <Download size={13} /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Send payment form */}
      {showSendForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-bold text-[#111] mb-4">Send Payment to Artist</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Artist Name</label>
              <input placeholder="e.g. Sasha K." className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#FFBC5D] transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount</label>
              <div className="relative">
                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input placeholder="0.00" className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#FFBC5D] transition-all" />
              </div>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note (optional)</label>
            <input placeholder="e.g. Thursday class payment 3/13" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#FFBC5D] transition-all" />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => setShowSendForm(false)} className="px-4 py-2 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
            <button className="px-5 py-2 rounded-xl text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity flex items-center gap-1.5">
              <Send size={12} /> Send Payment
            </button>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Paid This Month</p>
          <p className="text-2xl font-black text-[#111]">$443.75</p>
          <p className="text-xs text-gray-400 mt-1">4 transactions</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Pending</p>
          <p className="text-2xl font-black text-[#111]">$180.00</p>
          <p className="text-xs text-amber-500 font-medium mt-1">1 awaiting confirmation</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1">Total Paid (Season)</p>
          <p className="text-2xl font-black text-[#111]">$4,820</p>
          <p className="text-xs text-green-500 font-medium mt-1">↑ 18% vs last season</p>
        </div>
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#111]">Transaction History</h2>
          <button className="text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity flex items-center gap-1">
            <Download size={12} /> Export CSV
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                tx.type === "out" ? "bg-orange-50" : "bg-green-50"
              }`}>
                {tx.type === "out"
                  ? <ArrowUpRight size={16} className="text-[#F25722]" />
                  : <ArrowDownLeft size={16} className="text-green-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#111]">{tx.artist}</p>
                <p className="text-xs text-gray-400 truncate">{tx.job}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold ${tx.type === "out" ? "text-[#111]" : "text-green-600"}`}>{tx.amount}</p>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  {tx.status === "completed"
                    ? <CheckCircle size={10} className="text-green-400" />
                    : <Clock size={10} className="text-amber-400" />
                  }
                  <p className="text-xs text-gray-400">{tx.date}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment method */}
      <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#111]">Payment Method</h2>
          <button className="text-xs font-semibold text-[#F25722] hover:opacity-70 transition-opacity">Update</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-7 rounded-md bg-[#111] flex items-center justify-center">
            <CreditCard size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111]">Visa ending in 4242</p>
            <p className="text-xs text-gray-400">Expires 12/27</p>
          </div>
          <span className="ml-auto text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Default</span>
        </div>
      </div>
    </div>
  );
}
