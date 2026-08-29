/**
 * CompanyManager — the one place company profiles get edited.
 * Used identically on /app/settings (Profile tab) and /app/jobs (My Jobs
 * sidebar) — same list, same inline editor, same mutations, so editing a
 * company from either page behaves exactly the same way.
 */
import { useRef, useState } from "react";
import { Building2, Camera, Check, Loader2, MapPin, Pencil, Plus, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import LocationAutocompleteInput from "@/components/LocationAutocompleteInput";
import { useLocationField, toLocationData, type LocationDataPayload } from "@/hooks/useLocationField";

function fixUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

type Company = {
  id: number;
  name: string | null;
  description: string | null;
  logo: string | null;
  website: string | null;
  locationAddress: string | null;
  transportReimbursed?: boolean | null;
  transportDetails?: string | null;
};

function CompanyEditForm({ company, onSaved, onCancel }: { company: Company; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: company.name ?? "",
    description: company.description ?? "",
    logo: company.logo ?? "",
    website: company.website ?? "",
    locationAddress: company.locationAddress ?? "",
    locationData: undefined as LocationDataPayload | undefined,
    transportReimbursed: company.transportReimbursed ?? false,
    transportDetails: company.transportDetails ?? "",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const updateCompany = trpc.companies.updateById.useMutation({
    onSuccess: () => { toast.success("Company saved!"); onSaved(); },
    onError: (e) => toast.error(e.message || "Failed to save company"),
  });
  const uploadLogo = trpc.companies.uploadLogo.useMutation({
    onSuccess: (data) => setForm((f) => ({ ...f, logo: data.url })),
    onError: (e) => toast.error(e.message || "Failed to upload logo"),
  });

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadLogo.mutate({ id: company.id, base64, contentType: file.type });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
          {fixUrl(form.logo) ? (
            <img src={fixUrl(form.logo)!} alt="logo" className="w-full h-full object-cover" />
          ) : (
            <Building2 size={18} className="text-gray-300" />
          )}
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadLogo.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          {uploadLogo.isPending ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          {uploadLogo.isPending ? "Uploading…" : "Upload Photo"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
      </div>
      <input
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        placeholder="Company name"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F25722]"
      />
      <LocationAutocompleteInput
        value={form.locationAddress}
        onChange={(place) =>
          setForm((f) => ({
            ...f,
            locationAddress: place.formatted,
            locationData: toLocationData(place),
          }))
        }
        // Studios are usually a named venue or a street address, not a city.
        kind="any"
        placeholder="Location"
        icon={false}
        inputClassName="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F25722]"
      />
      <input
        value={form.website}
        onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
        placeholder="Website (optional)"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F25722]"
      />
      <textarea
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        placeholder="About this company (optional)"
        rows={3}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F25722] resize-none"
      />
      <div className="pt-1 border-t border-gray-200">
        <label className="flex items-center gap-2 text-sm text-gray-700 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.transportReimbursed}
            onChange={(e) => setForm((f) => ({ ...f, transportReimbursed: e.target.checked }))}
            className="w-4 h-4 rounded accent-[#F25722]"
          />
          This company reimburses artist transportation
        </label>
        {form.transportReimbursed && (
          <input
            value={form.transportDetails}
            onChange={(e) => setForm((f) => ({ ...f, transportDetails: e.target.value }))}
            placeholder="Transport reimbursement details (e.g. mileage rate, policy)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F25722]"
          />
        )}
        <p className="text-[11px] text-gray-400 mt-1.5">Applied automatically when you post a new job for this company.</p>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors">
          <X size={13} /> Cancel
        </button>
        <button
          onClick={() => updateCompany.mutate({ id: company.id, ...form })}
          disabled={updateCompany.isPending || !form.name.trim()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {updateCompany.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Save
        </button>
      </div>
    </div>
  );
}

function AddCompanyForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const location = useLocationField();
  const addCompany = trpc.postJob.addCompany.useMutation({
    onSuccess: () => { toast.success("Company added!"); onAdded(); },
    onError: (e) => toast.error(e.message || "Failed to add company"),
  });

  return (
    <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Company name"
        autoFocus
        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F25722]"
      />
      <LocationAutocompleteInput
        value={location.value}
        onChange={location.onChange}
        kind="any"
        placeholder="Location"
        icon={false}
        inputClassName="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F25722]"
      />
      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors">
          <X size={13} /> Cancel
        </button>
        <button
          onClick={() => addCompany.mutate({
            name,
            locationAddress: location.value || undefined,
            locationData: location.locationData,
          })}
          disabled={addCompany.isPending || !name.trim()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {addCompany.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Add Company
        </button>
      </div>
    </div>
  );
}

export default function CompanyManager({ onSelectCompany, selectedCompanyId }: {
  /** Optional — when provided, clicking a company (outside edit mode) selects it instead of just expanding info. */
  onSelectCompany?: (id: number) => void;
  selectedCompanyId?: number | null;
}) {
  const { data, isLoading, refetch } = trpc.companies.list.useQuery();
  const companies = data?.companies ?? [];
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {companies.map((c: any) =>
        editingId === c.id ? (
          <CompanyEditForm
            key={c.id}
            company={c}
            onCancel={() => setEditingId(null)}
            onSaved={() => { setEditingId(null); refetch(); }}
          />
        ) : (
          <div
            key={c.id}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
              selectedCompanyId === c.id ? "border-[#F25722] bg-orange-50/40" : "border-gray-100 hover:bg-gray-50"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectCompany?.(c.id)}
              className="flex-1 min-w-0 flex items-center gap-3 text-left"
            >
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                {fixUrl(c.logo) ? (
                  <img src={fixUrl(c.logo)!} alt={c.name ?? ""} className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={15} className="text-gray-300" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#111] truncate">{c.name || "Studio"}</p>
                {c.locationAddress && (
                  <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                    <MapPin size={9} /> {c.locationAddress}
                  </p>
                )}
              </div>
            </button>
            <button
              onClick={() => setEditingId(c.id)}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-[#F25722] transition-colors"
              aria-label={`Edit ${c.name}`}
            >
              <Pencil size={14} />
            </button>
          </div>
        )
      )}

      {adding ? (
        <AddCompanyForm
          onCancel={() => setAdding(false)}
          onAdded={() => { setAdding(false); refetch(); }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-2.5 rounded-xl border border-dashed border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus size={13} /> Add Another Company
        </button>
      )}
    </div>
  );
}
