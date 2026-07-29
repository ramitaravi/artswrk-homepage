/*
 * ARTSWRK DASHBOARD — COMPANY PAGE (editable + shareable)
 * Route: /app/company
 */
import { useState, useEffect } from "react";
import {
  Building2, MapPin, Globe, Instagram, Edit3, Eye, CheckCircle2,
  Copy, Check, Loader2, Briefcase, ExternalLink, Save, X,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

function fixUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function CompanyPage() {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch } = trpc.companies.get.useQuery();
  const updateMutation = trpc.companies.update.useMutation({
    onSuccess: () => { refetch(); setEditing(false); },
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    logo: "",
    website: "",
    locationAddress: "",
  });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.company?.name || data.owner.clientCompanyName || data.owner.name || "",
        description: data.company?.description || "",
        logo: fixUrl(data.company?.logo || data.owner.profilePicture) || "",
        website: data.company?.website || data.owner.website || "",
        locationAddress: data.company?.locationAddress || data.owner.location || "",
      });
    }
  }, [data]);

  const handleSave = () => {
    updateMutation.mutate({
      name: form.name || "My Studio",
      description: form.description || null,
      logo: form.logo || null,
      website: form.website || null,
      locationAddress: form.locationAddress || null,
    });
  };

  const publicUrl = data?.owner.id ? `${window.location.origin}/studio/${data.owner.id}` : null;

  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 size={28} className="animate-spin text-gray-300" />
    </div>
  );

  const owner = data?.owner;
  const company = data?.company;
  const jobs = data?.jobs ?? [];

  const displayName = editing ? form.name : (company?.name || owner?.clientCompanyName || owner?.name || "My Studio");
  const displayLogo = editing ? (fixUrl(form.logo) || null) : (fixUrl(company?.logo) || fixUrl(owner?.profilePicture));
  const displayAbout = editing ? form.description : (company?.description || "");
  const displayLocation = editing ? form.locationAddress : (company?.locationAddress || owner?.location || "");
  const displayWebsite = editing ? form.website : (company?.website || owner?.website || "");
  const instagram = owner?.instagram;
  const isPro = owner?.artswrkPro || owner?.artswrkBasic;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#111]">Company Page</h1>
          <p className="text-sm text-gray-500 mt-0.5">Edit your public studio profile that artists discover</p>
        </div>
        <div className="flex items-center gap-2">
          {publicUrl && (
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {copied ? <><Check size={12} className="text-green-500" /> Copied!</> : <><Copy size={12} /> Copy Link</>}
            </button>
          )}
          {publicUrl && (
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <Eye size={12} /> Preview
              </button>
            </a>
          )}
          {editing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <X size={13} /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save Changes
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
            >
              <Edit3 size={13} /> Edit Page
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left: Job Openings ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Hero banner preview */}
          <div className="h-32 rounded-2xl mb-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #F25722 0%, #FFBC5D 100%)" }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white/60 text-xs font-semibold">Cover Banner</p>
            </div>
          </div>

          <h2 className="text-2xl font-black text-[#111] mb-1">Our Job Openings</h2>
          <p className="text-sm text-gray-500 mb-6">Apply to our open roles below!</p>

          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 bg-white rounded-2xl border border-gray-100 text-gray-400">
              <Briefcase size={32} className="mb-2 opacity-30" />
              <p className="text-sm font-medium text-gray-500">No active jobs yet</p>
              <p className="text-xs mt-1 text-gray-400">Active jobs will appear here for artists to apply.</p>
              <Link href="/post-job">
                <button className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#F25722] hover:opacity-90 transition-opacity">
                  Post a Job
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                    {displayLogo ? (
                      <img src={displayLogo} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-black text-gray-400">{getInitials(displayName)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#111] leading-snug">{job.title || "Open Role"}</p>
                    {job.locationAddress && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <MapPin size={10} />{job.locationAddress}
                      </p>
                    )}
                    {job.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{job.description}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">Active</span>
                    {job.slug && (
                      <a href={`/jobs/${job.slug}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={13} className="text-gray-300 hover:text-gray-500" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Company Card (editable) ─────────────────────────────── */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-6">
            {/* Logo */}
            <div className="flex justify-center pt-6 pb-3 px-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md flex items-center justify-center">
                  {displayLogo ? (
                    <img src={displayLogo} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 size={32} className="text-gray-300" />
                  )}
                </div>
                {isPro && (
                  <div className="absolute bottom-0 right-0">
                    <CheckCircle2 size={22} className="text-[#F25722] fill-white" />
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 pb-5">
              {/* Name */}
              <div className="text-center mb-4">
                {editing ? (
                  <input
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Studio name"
                    className="text-center text-lg font-black text-[#111] border-b-2 border-[#FFBC5D] focus:outline-none bg-transparent w-full mb-1"
                  />
                ) : (
                  <h2 className="text-xl font-black text-[#111] flex items-center justify-center gap-1.5">
                    {displayName}
                    {isPro && <CheckCircle2 size={17} className="text-[#F25722] flex-shrink-0" />}
                  </h2>
                )}
                {isPro && <p className="text-sm font-semibold text-[#F25722] mt-0.5">Artswrk Premium Studio</p>}
              </div>

              {/* Location */}
              <div className="mb-3">
                {editing ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 focus-within:border-[#FFBC5D] transition-colors">
                    <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                    <input
                      value={form.locationAddress}
                      onChange={(e) => setForm(f => ({ ...f, locationAddress: e.target.value }))}
                      placeholder="Studio location"
                      className="flex-1 text-sm text-gray-700 focus:outline-none bg-transparent"
                    />
                  </div>
                ) : displayLocation ? (
                  <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                    <MapPin size={10} />{displayLocation}
                  </p>
                ) : null}
              </div>

              {/* Logo URL (edit mode only) */}
              {editing && (
                <div className="mb-3">
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Logo URL</label>
                  <input
                    value={form.logo}
                    onChange={(e) => setForm(f => ({ ...f, logo: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#FFBC5D] focus:outline-none text-sm text-gray-700 transition-colors"
                  />
                </div>
              )}

              {/* About */}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-[#111] mb-2">About</h3>
                {editing ? (
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe your studio, what you offer, your philosophy..."
                    rows={5}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-[#FFBC5D] focus:outline-none text-sm text-gray-600 leading-relaxed resize-none transition-colors"
                  />
                ) : displayAbout ? (
                  <p className="text-sm text-gray-600 leading-relaxed">{displayAbout}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No description yet. Click Edit Page to add one.</p>
                )}
              </div>

              {/* Website */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                {editing ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 focus-within:border-[#FFBC5D] transition-colors">
                    <Globe size={14} className="text-gray-400 flex-shrink-0" />
                    <input
                      value={form.website}
                      onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))}
                      placeholder="https://yourstudio.com"
                      className="flex-1 text-sm text-gray-700 focus:outline-none bg-transparent"
                    />
                  </div>
                ) : displayWebsite ? (
                  <a href={displayWebsite.startsWith("http") ? displayWebsite : `https://${displayWebsite}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#F25722] transition-colors">
                    <Globe size={14} className="flex-shrink-0" />
                    <span className="truncate">{displayWebsite.replace(/^https?:\/\//, "")}</span>
                  </a>
                ) : null}
                {instagram && !editing && (
                  <a href={instagram.startsWith("http") ? instagram : `https://instagram.com/${instagram.replace("@","")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#ec008c] transition-colors">
                    <Instagram size={14} className="flex-shrink-0" />
                    <span>{instagram.startsWith("@") ? instagram : `@${instagram}`}</span>
                  </a>
                )}
              </div>

              {/* Share link */}
              {publicUrl && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Your public page</p>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                    <span className="text-xs text-gray-500 flex-1 truncate">{publicUrl.replace(/^https?:\/\//, "")}</span>
                    <button onClick={copyLink} className="flex-shrink-0">
                      {copied
                        ? <Check size={14} className="text-green-500" />
                        : <Copy size={14} className="text-gray-400 hover:text-gray-600" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
