/**
 * Leads Dashboard — Lists
 * Compact list-style rows with subscriber counts, search filter, and create/delete actions.
 */
import { useState } from "react";
import LeadsLayout from "@/components/LeadsLayout";
import { trpc } from "@/lib/trpc";
import {
  Plus,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  ExternalLink,
  List,
  Search,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 50;

export default function LeadsLists() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState("");

  const { data, isLoading, refetch } = trpc.leads.getLists.useQuery(
    { limit: PAGE_SIZE, offset, sort: "desc" },
    { staleTime: 5 * 60 * 1000 }
  );

  const createMutation = trpc.leads.createList.useMutation({
    onSuccess: () => {
      toast.success("List created");
      setNewListName("");
      setShowCreate(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.leads.deleteList.useMutation({
    onSuccess: () => { toast.success("List deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const allLists = data?.lists ?? [];
  const filtered = search
    ? allLists.filter((l: any) => l.name.toLowerCase().includes(search.toLowerCase()))
    : allLists;

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <LeadsLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#111]">Lists</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {data ? `${data.count.toLocaleString()} lists in Brevo` : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://app.brevo.com/contacts/lists"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#0B5FFF] hover:underline font-medium"
            >
              Open in Brevo <ExternalLink size={11} />
            </a>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#111] hover:bg-gray-800 transition-colors px-3 py-2 rounded-xl"
            >
              <Plus size={12} /> New List
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
            <p className="text-sm font-semibold text-[#111] mb-3">Create a new list</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name…"
                autoFocus
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#0B5FFF] transition-colors"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newListName.trim()) createMutation.mutate({ name: newListName.trim() });
                }}
              />
              <button
                onClick={() => newListName.trim() && createMutation.mutate({ name: newListName.trim() })}
                disabled={!newListName.trim() || createMutation.isPending}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#111] hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Create"}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm mb-4">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter lists…"
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#0B5FFF] transition-colors bg-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X size={13} />
            </button>
          )}
        </div>

        {/* List rows */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[#0B5FFF]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <List size={32} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">{search ? "No lists match your filter" : "No lists found"}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {filtered.map((list: any) => {
              const subscribers = list.uniqueSubscribers ?? list.totalSubscribers ?? 0;
              const unsubs = list.totalBlacklisted ?? list.totalUnsubscribers ?? 0;

              return (
                <div
                  key={list.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                >
                  {/* Icon */}
                  <div className="w-7 h-7 rounded-lg bg-[#EEF3FF] flex items-center justify-center flex-shrink-0">
                    <List size={12} className="text-[#0B5FFF]" />
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#111] truncate">{list.name}</p>
                    <p className="text-[10px] text-gray-400">ID #{list.id}</p>
                  </div>

                  {/* Subscriber count */}
                  <div className="flex items-center gap-1 text-[10px] text-gray-600 flex-shrink-0">
                    <Users size={9} className="text-gray-400" />
                    <span className="font-semibold">{subscribers.toLocaleString()}</span>
                    <span className="text-gray-300">sub</span>
                  </div>

                  {/* Unsubscribed count */}
                  {unsubs > 0 && (
                    <span className="text-[10px] text-red-400 flex-shrink-0 hidden sm:block">
                      {unsubs.toLocaleString()} unsub
                    </span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={`https://app.brevo.com/contacts/lists/${list.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-gray-300 hover:text-[#0B5FFF] hover:bg-[#EEF3FF] transition-colors"
                      title="Open in Brevo"
                    >
                      <ExternalLink size={11} />
                    </a>
                    <button
                      onClick={() => {
                        if (confirm(`Delete list "${list.name}"? This cannot be undone.`)) {
                          deleteMutation.mutate({ id: list.id });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Delete list"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !search && (
          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, data?.count ?? 0)} of {(data?.count ?? 0).toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="p-2 rounded-xl border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-gray-500 font-semibold px-2">{currentPage} / {totalPages}</span>
              <button disabled={offset + PAGE_SIZE >= (data?.count ?? 0)} onClick={() => setOffset(offset + PAGE_SIZE)} className="p-2 rounded-xl border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </LeadsLayout>
  );
}
