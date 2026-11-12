/**
 * Artswrk Data Hub controls on the Leads CRM page:
 *   - run the Brevo → engagement → DNC → HubSpot sync (also runs nightly)
 *   - import a CSV export of a master Data Hub sheet tab (Row IDs + DNC)
 */
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Database, RefreshCw, Upload } from "lucide-react";

type Tab = "master_list" | "dance_tam" | "dnc_log";
const TABS: { value: Tab; label: string }[] = [
  { value: "master_list", label: "Studios | Ensemble Master List" },
  { value: "dance_tam", label: "Studios | Dance TAM (Non Ensemble)" },
  { value: "dnc_log", label: "DNC Log" },
];

export function DataHubPanel() {
  const [tab, setTab] = useState<Tab>("dnc_log");
  const fileRef = useRef<HTMLInputElement>(null);

  const status = trpc.leads.getDataHubStatus.useQuery(undefined, {
    refetchInterval: (q) => (q.state.data?.running ? 3000 : false),
    refetchOnWindowFocus: false,
  });

  const sync = trpc.leads.syncDataHub.useMutation({
    onSuccess: (r) => {
      toast[r.started ? "success" : "info"](r.started ? "Data Hub sync started" : "A sync is already running");
      status.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const importCsv = trpc.leads.importDataHubCsv.useMutation({
    onSuccess: (r) => toast.success(`Imported ${r.rows.toLocaleString()} rows · ${r.dnc} Do Not Contact`),
    onError: (e) => toast.error(`Import failed: ${e.message}`),
  });

  const onFile = async (file?: File) => {
    if (!file) return;
    importCsv.mutate({ tab, csv: await file.text() });
    if (fileRef.current) fileRef.current.value = "";
  };

  const s = status.data;
  const hub = (s?.result as any)?.hubspot;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 mb-5 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2 min-w-[220px]">
        <Database size={16} className="text-gray-500" />
        <div>
          <p className="text-sm font-semibold text-gray-900">Artswrk Data Hub → HubSpot</p>
          <p className="text-xs text-gray-500">
            {s?.running
              ? `${s.step ?? "Running"}…`
              : s?.error
                ? `Last run failed: ${s.error}`
                : s?.finishedAt
                  ? `Last run ${new Date(s.finishedAt).toLocaleString()}${hub ? ` · ${hub.upserted.toLocaleString()} contacts pushed` : ""}`
                  : "Runs nightly · Brevo, Artswrk users, DNC"}
          </p>
        </div>
      </div>

      <Button
        size="sm"
        onClick={() => sync.mutate()}
        disabled={s?.running || sync.isPending}
        className="bg-[#111] hover:bg-gray-800 text-white text-xs"
      >
        <RefreshCw size={13} className={`mr-1.5 ${s?.running ? "animate-spin" : ""}`} />
        {s?.running ? "Syncing…" : "Sync to HubSpot"}
      </Button>

      <div className="flex items-center gap-2 ml-auto">
        <select
          value={tab}
          onChange={(e) => setTab(e.target.value as Tab)}
          className="h-8 text-xs border border-gray-200 rounded-md px-2 bg-white"
        >
          {TABS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button size="sm" variant="outline" className="text-xs" disabled={importCsv.isPending} onClick={() => fileRef.current?.click()}>
          <Upload size={13} className="mr-1.5" />
          {importCsv.isPending ? "Importing…" : "Import sheet CSV"}
        </Button>
      </div>
    </div>
  );
}
