/**
 * Leads Dashboard — Lists
 * Paginated table of Brevo contact lists with create/delete actions.
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
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 50;

function CreateListModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const create = trpc.leads.createList.useMutation({
    onSuccess: () => {
      toast.success("List created");
      onCreated();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[#111]">Create New List</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={15} />
          </button>
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

export default function LeadsLists() {
  const [offset, setOffset] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  const utils = trpc.useUtils();
  const { data, isLoading, refetch } = trpc.leads.getLists.useQuery(
    { limit: PAGE_SIZE, offset, sort: "desc" },
    { staleTime: 5 * 60 * 1000 }
  );

  const deleteList = trpc.leads.deleteList.useMutation({
    onSuccess: () => {
      toast.success("List deleted");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

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
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#0B5FFF] hover:bg-[#0047CC] transition-colors"
          >
            <Plus size={14} />
            New List
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["List Name", "Subscribers", "Unsubscribed", "Created"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-gray-400 px-6 py-3"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 size={22} className="animate-spin text-[#0B5FFF] mx-auto" />
                    </td>
                  </tr>
                ) : (data?.lists ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                      No lists found
                    </td>
                  </tr>
                ) : (
                  (data?.lists ?? []).map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#EEF3FF] flex items-center justify-center flex-shrink-0">
                            <Users size={12} className="text-[#0B5FFF]" />
                          </div>
                          <span className="font-medium text-[#111]">{l.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm font-semibold text-[#111]">
                          {(l.uniqueSubscribers ?? 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-400">
                        {(l.totalBlacklisted ?? 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {l.createdAt
                          ? new Date(l.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Delete list "${l.name}"? This cannot be undone.`)) {
                              deleteList.mutate({ id: l.id });
                            }
                          }}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(data?.count ?? 0) > PAGE_SIZE && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, data?.count ?? 0)} of{" "}
                {(data?.count ?? 0).toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-gray-500 font-medium">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={offset + PAGE_SIZE >= (data?.count ?? 0)}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateListModal
          onClose={() => setShowCreate(false)}
          onCreated={() => refetch()}
        />
      )}
    </LeadsLayout>
  );
}
