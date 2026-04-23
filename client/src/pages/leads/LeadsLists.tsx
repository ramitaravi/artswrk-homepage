/**
 * Leads Dashboard — Lists
 * Card-based layout of Brevo contact lists with create/delete actions.
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
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 30;

const LIST_COLORS = [
  "bg-orange-100 text-orange-600",
  "bg-pink-100 text-pink-600",
  "bg-blue-100 text-blue-600",
  "bg-purple-100 text-purple-600",
  "bg-emerald-100 text-emerald-600",
  "bg-amber-100 text-amber-600",
  "bg-cyan-100 text-cyan-600",
  "bg-rose-100 text-rose-600",
];

function listColor(id: number) {
  return LIST_COLORS[id % LIST_COLORS.length];
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CreateListModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const create = trpc.leads.createList.useMutation({
    onSuccess: () => { toast.success("List created"); onCreated(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[#111]">Create New List</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} /></button>
        </div>
        <input
          type="text"
          placeholder="List name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#0B5FFF] mb-4"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && name.trim() && create.mutate({ name: name.trim() })}
        />
        <button
          disabled={!name.trim() || create.isPending}
          onClick={() => create.mutate({ name: name.trim() })}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0B5FFF] hover:bg-[#0047CC] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
        >
          {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Create List
        </button>
      </div>
    </div>
  );
}

function ListCard({ list, onDelete }: { list: any; onDelete: (id: number, name: string) => void }) {
  const color = listColor(list.id);
  const subscribers = list.uniqueSubscribers ?? 0;
  const unsubs = list.totalBlacklisted ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-4">
      {/* Icon + delete */}
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Users size={16} />
        </div>
        <button
          onClick={() => onDelete(list.id, list.name)}
          className="p-1.5 rounded-lg text-gray-200 hover:text-red-400 hover:bg-red-50 transition-colors"
          title="Delete list"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Name */}
      <div>
        <h3 className="font-bold text-[#111] text-sm leading-snug line-clamp-2">{list.name}</h3>
        {fmtDate(list.createdAt) && (
          <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
            <Calendar size={9} />
            <span>{fmtDate(list.createdAt)}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="border-t border-gray-50 pt-3 flex items-center justify-between">
        <div className="flex flex-col items-center">
          <span className="text-base font-black text-[#111]">{subscribers.toLocaleString()}</span>
          <span className="text-[10px] text-gray-400">subscribers</span>
        </div>
        {unsubs > 0 && (
          <>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex flex-col items-center">
              <span className="text-base font-black text-gray-400">{unsubs.toLocaleString()}</span>
              <span className="text-[10px] text-gray-400">unsubscribed</span>
            </div>
          </>
        )}
        <a
          href={`https://app.brevo.com/contacts/lists/${list.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg text-gray-300 hover:text-[#0B5FFF] hover:bg-blue-50 transition-colors"
          title="View in Brevo"
        >
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

export default function LeadsLists() {
  const [offset, setOffset] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, refetch } = trpc.leads.getLists.useQuery(
    { limit: PAGE_SIZE, offset, sort: "desc" },
    { staleTime: 5 * 60 * 1000 }
  );

  const deleteList = trpc.leads.deleteList.useMutation({
    onSuccess: () => { toast.success("List deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Delete list "${name}"? This cannot be undone.`)) {
      deleteList.mutate({ id });
    }
  };

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <LeadsLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#111]">Lists</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {data ? `${data.count.toLocaleString()} lists in Brevo` : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://app.brevo.com/contacts/lists" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-[#0B5FFF] hover:underline font-medium">
              Open in Brevo <ExternalLink size={11} />
            </a>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#0B5FFF] hover:bg-[#0047CC] transition-colors"
            >
              <Plus size={14} /> New List
            </button>
          </div>
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[#0B5FFF]" />
          </div>
        ) : (data?.lists ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Users size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No lists found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {(data?.lists ?? []).map((l: any) => (
              <ListCard key={l.id} list={l} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {(data?.count ?? 0) > PAGE_SIZE && (
          <div className="mt-8 flex items-center justify-between">
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

      {showCreate && <CreateListModal onClose={() => setShowCreate(false)} onCreated={() => refetch()} />}
    </LeadsLayout>
  );
}
