/*
 * ARTSWRK DASHBOARD — MY JOBS
 * Multi-company tabs at top. Left: job listings. Right: editable company profile card.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, MapPin, Globe, Instagram, Edit3, Eye, CheckCircle2,
  Copy, Check, Loader2, Briefcase, ExternalLink, Save, X,
  Clock, DollarSign, Zap, Building2, ChevronRight, ArrowUpRight,
  Camera, ChevronDown,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import BoostJobModal from "@/components/BoostJobModal";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function formatJobDate(d: string | Date | null | undefined) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusColor(s: string | null | undefined) {
  switch (s) {
    case "Active": return "text-green-600 bg-green-50";
    case "Confirmed": return "text-blue-600 bg-blue-50";
    case "Completed": return "text-gray-500 bg-gray-100";
    default: return "text-[#F25722] bg-orange-50";
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashJobs() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"active" | "all">("active");
  // null = "All companies" (no filter)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [boostJobId, setBoostJobId] = useState<number | null>(null);
  const [boostJobTitle, setBoostJobTitle] = useState("");

  // ── Company list ──────────────────────────────────────────────────────────────
  const { data: companiesData, isLoading: companiesLoading, refetch: refetchCompanies } =
    trpc.companies.list.useQuery();

  const companies = companiesData?.companies ?? [];

  // The card always shows a company — use the selected one, or fall back to first
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? companies[0] ?? null;
  const cardCompanyId = selectedCompany?.id ?? null;

  // ── Fallback: single company data (for users with no client_companies row yet) ─
  const { data: companyData, isLoading: companyFallbackLoading, refetch: refetchFallback } =
    trpc.companies.get.useQuery(undefined, { enabled: companies.length === 0 && !companiesLoading });

  const updateCompany = trpc.companies.update.useMutation({
    onSuccess: () => { refetchFallback(); refetchCompanies(); setEditing(false); },
  });

  const updateCompanyById = trpc.companies.updateById.useMutation({
    onSuccess: () => { refetchCompanies(); setEditing(false); },
  });

  const uploadLogo = trpc.companies.uploadLogo.useMutation({
    onSuccess: (data) => { setForm(f => ({ ...f, logo: data.url })); refetchCompanies(); },
  });

  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompany?.id) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadLogo.mutate({ id: selectedCompany.id, base64, contentType: file.type });
    };
    reader.readAsDataURL(file);
  };

  // Form state
  const [form, setForm] = useState({
    name: "", description: "", logo: "", website: "", locationAddress: "",
  });

  // Sync form with selected company
  useEffect(() => {
    if (selectedCompany) {
      setForm({
        name: selectedCompany.name || "",
        description: selectedCompany.description || "",
        logo: fixUrl(selectedCompany.logo) || "",
        website: selectedCompany.website || "",
        locationAddress: selectedCompany.locationAddress || "",
      });
    } else if (companyData && companies.length === 0) {
      setForm({
        name: companyData.company?.name || companyData.owner.clientCompanyName || companyData.owner.name || "",
        description: companyData.company?.description || "",
        logo: fixUrl(companyData.company?.logo || companyData.owner.profilePicture) || "",
        website: companyData.company?.website || companyData.owner.website || "",
        locationAddress: companyData.company?.locationAddress || companyData.owner.location || "",
      });
    }
    setEditing(false);
  }, [selectedCompanyId, selectedCompany?.id, companyData?.owner.id]);

  const handleSaveCompany = () => {
    if (selectedCompany?.id) {
      updateCompanyById.mutate({
        id: selectedCompany.id,
        name: form.name || "My Studio",
        description: form.description || null,
        logo: form.logo || null,
        website: form.website || null,
        locationAddress: form.locationAddress || null,
      });
    } else {
      updateCompany.mutate({
        name: form.name || "My Studio",
        description: form.description || null,
        logo: form.logo || null,
        website: form.website || null,
        locationAddress: form.locationAddress || null,
      });
    }
  };

  const isSaving = updateCompany.isPending || updateCompanyById.isPending;

  // Derived display values
  const owner = companyData?.owner;
  const displayName = editing
    ? form.name
    : (selectedCompany?.name || owner?.clientCompanyName || owner?.name || "My Studio");
  const displayLogo = editing
    ? (fixUrl(form.logo) || null)
    : (fixUrl(selectedCompany?.logo) || fixUrl(owner?.profilePicture));
  const displayAbout = editing ? form.description : (selectedCompany?.description || companyData?.company?.description || "");
  const displayLocation = editing
    ? form.locationAddress
    : (selectedCompany?.locationAddress || owner?.location || "");
  const displayWebsite = editing ? form.website : (selectedCompany?.website || owner?.website || "");
  const instagram = owner?.instagram;
  const isPro = owner?.artswrkPro || owner?.artswrkBasic;

  const ownerId = owner?.id ?? companyData?.owner?.id;
  const publicUrl = ownerId ? `${window.location.origin}/studio/${ownerId}` : null;

  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Jobs data ─────────────────────────────────────────────────────────────────
  const statusFilters = { active: ["Active", "Confirmed"], all: undefined };
  const { data: jobs, isLoading: jobsLoading } = trpc.jobs.myJobs.useQuery({
    limit: 100,
    status: statusFilters[activeTab],
  });

  // Filter jobs by selected company via bubbleClientCompanyId (the reliable join key)
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    if (selectedCompanyId === null) return jobs;
    const company = companies.find((c) => c.id === selectedCompanyId);
    if (!company?.bubbleClientCompanyId) return jobs;
    const matched = jobs.filter((j) => j.bubbleClientCompanyId === company.bubbleClientCompanyId);
    return matched.length > 0 ? matched : jobs;
  }, [jobs, selectedCompanyId, companies]);

  const navigateToPostJob = () => {
    const blank = {
      title: null, description: "", locationAddress: null, dateType: "Single Date",
      startDate: null, endDate: null, isHourly: false, openRate: true,
      clientHourlyRate: null, clientFlatRate: null, transportation: false, serviceType: null,
    };
    sessionStorage.setItem("postJobParsed", JSON.stringify({ rawText: "", parsed: blank }));
    navigate("/post-job");
  };

  const companyLoading = companiesLoading || (companies.length === 0 && companyFallbackLoading);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#111]">My Jobs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your studio profile and job listings</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {publicUrl && (
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {copied ? <><Check size={12} className="text-green-500" /> Copied!</> : <><Copy size={12} /> Copy Link</>}
            </button>
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
                onClick={handleSaveCompany}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Edit3 size={13} /> Edit Profile
            </button>
          )}
          <button
            onClick={navigateToPostJob}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Post a Job
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left: Job listings ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {/* Status tabs */}
            <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
              {(["active", "all"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === t ? "hirer-grad-bg text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {t === "active" ? "Active Jobs" : "All Jobs"}
                </button>
              ))}
            </div>

            {/* Company dropdown filter — only when there are multiple */}
            {!companyLoading && companies.length > 1 && (
              <div className="relative">
                <select
                  value={selectedCompanyId ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCompanyId(val === "" ? null : Number(val));
                    setEditing(false);
                  }}
                  className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:border-gray-300 focus:outline-none focus:border-[#F25722] transition-colors cursor-pointer"
                >
                  <option value="">All Studios</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || "Unnamed Studio"}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>

          {jobsLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 size={22} className="animate-spin mr-3" />
              <span className="text-sm">Loading jobs…</span>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400">
              <Briefcase size={32} className="mb-2 opacity-30" />
              <p className="text-sm font-medium text-gray-500">No {activeTab === "active" ? "active " : ""}jobs yet</p>
              <p className="text-xs mt-1 text-gray-400">Post a job to start receiving applications.</p>
              <button
                onClick={navigateToPostJob}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white hirer-grad-bg hover:opacity-90 transition-opacity"
              >
                Post a Job
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/app/jobs/${job.id}`)}
                >
                  <div className="flex items-start gap-4 p-5">
                    {/* Logo */}
                    <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                      {displayLogo ? (
                        <img src={displayLogo} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-black text-gray-400">{getInitials(displayName)}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#111] leading-snug">
                            {job.title || job.description?.slice(0, 60) || "Job Posting"}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{displayName}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {job.requestStatus && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(job.requestStatus)}`}>
                              {job.requestStatus}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {job.locationAddress && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <MapPin size={10} />{job.locationAddress.split(",").slice(0, 2).join(",")}
                          </span>
                        )}
                        {job.dateType && (
                          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{job.dateType}</span>
                        )}
                        {job.clientHourlyRate ? (
                          <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                            <DollarSign size={10} />${job.clientHourlyRate}/hr
                          </span>
                        ) : job.openRate ? (
                          <span className="text-xs text-gray-400">Open rate</span>
                        ) : null}
                        {job.bubbleCreatedAt && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={10} />{formatJobDate(job.bubbleCreatedAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Boost + View applicants */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {(job.requestStatus === "Active" || job.requestStatus === "Confirmed") && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setBoostJobId(job.id); setBoostJobTitle(job.title || job.description?.slice(0, 50) || "Job"); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-50 text-[#F25722] text-xs font-bold hover:bg-orange-100 transition-colors"
                        >
                          <Zap size={11} /> Boost
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/app/jobs/${job.id}`); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-500 text-xs font-semibold hover:bg-gray-100 transition-colors"
                      >
                        View <ChevronRight size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Company profile card ─────────────────────────────────── */}
        <div className="w-full lg:w-72 flex-shrink-0">
          {companyLoading ? (
            <div className="flex items-center justify-center h-48 bg-white rounded-2xl border border-gray-100">
              <Loader2 size={22} className="animate-spin text-gray-300" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-6">
              {/* Gradient banner */}
              <div className="h-20" style={{ background: "linear-gradient(135deg, #F25722 0%, #FFBC5D 100%)" }} />

              {/* Logo overlapping banner */}
              <div className="flex justify-center -mt-10 mb-2">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md flex items-center justify-center">
                    {displayLogo ? (
                      <img src={displayLogo} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 size={28} className="text-gray-300" />
                    )}
                  </div>
                  {isPro && (
                    <div className="absolute bottom-0 right-0">
                      <CheckCircle2 size={20} className="text-[#F25722] fill-white" />
                    </div>
                  )}
                </div>
              </div>

              <div className="px-5 pb-5">
                {/* Name */}
                <div className="text-center mb-3">
                  {editing ? (
                    <input
                      value={form.name}
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Studio name"
                      className="text-center text-base font-black text-[#111] border-b-2 border-[#FFBC5D] focus:outline-none bg-transparent w-full mb-1"
                    />
                  ) : (
                    <h2 className="text-lg font-black text-[#111] flex items-center justify-center gap-1.5">
                      {displayName}
                      {isPro && <CheckCircle2 size={15} className="text-[#F25722] flex-shrink-0" />}
                    </h2>
                  )}
                  {isPro && <p className="text-xs font-semibold text-[#F25722] mt-0.5">Artswrk Premium Studio</p>}
                </div>

                {/* Primary location (editing input) */}
                {editing && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 focus-within:border-[#FFBC5D] transition-colors">
                      <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                      <input
                        value={form.locationAddress}
                        onChange={(e) => setForm(f => ({ ...f, locationAddress: e.target.value }))}
                        placeholder="Studio location"
                        className="flex-1 text-sm text-gray-700 focus:outline-none bg-transparent"
                      />
                    </div>
                  </div>
                )}

                {/* Logo upload (edit only) */}
                {editing && (
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-gray-500 mb-2 block">Company Logo</label>
                    <div className="flex items-center gap-3">
                      {/* Preview */}
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                        {fixUrl(form.logo) ? (
                          <img src={fixUrl(form.logo)!} alt="logo" className="w-full h-full object-cover" />
                        ) : (
                          <Building2 size={18} className="text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploadLogo.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
                        >
                          {uploadLogo.isPending ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                          {uploadLogo.isPending ? "Uploading…" : "Upload Photo"}
                        </button>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoFile}
                        />
                        <input
                          value={form.logo}
                          onChange={(e) => setForm(f => ({ ...f, logo: e.target.value }))}
                          placeholder="or paste URL…"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 focus:border-[#FFBC5D] focus:outline-none text-xs text-gray-500 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* All locations — one per company row, clickable to switch */}
                {!editing && (
                  <div className="mb-3">
                    {companies.length > 1 ? (
                      <>
                        <h3 className="text-xs font-bold text-[#111] mb-2">Locations</h3>
                        <div className="space-y-1.5">
                          {companies.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => setSelectedCompanyId(c.id)}
                              className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${
                                c.id === selectedCompanyId
                                  ? "bg-orange-50 text-[#F25722]"
                                  : "text-gray-500 hover:bg-gray-50"
                              }`}
                            >
                              <MapPin size={11} className="mt-0.5 flex-shrink-0" />
                              <span className="text-xs leading-snug">
                                {c.locationAddress || c.name || "Unnamed location"}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : displayLocation ? (
                      <p className="text-xs text-gray-500 flex items-center gap-1.5">
                        <MapPin size={11} className="flex-shrink-0" />{displayLocation}
                      </p>
                    ) : null}
                  </div>
                )}

                {/* About */}
                <div className="mb-3 pt-3 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-[#111] mb-1.5">About</h3>
                  {editing ? (
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Describe your studio…"
                      rows={4}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-[#FFBC5D] focus:outline-none text-sm text-gray-600 leading-relaxed resize-none transition-colors"
                    />
                  ) : displayAbout ? (
                    <p className="text-xs text-gray-600 leading-relaxed">{displayAbout}</p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No description yet. Click Edit Profile to add one.</p>
                  )}
                </div>

                {/* Website + Instagram */}
                {(editing || displayWebsite || instagram) && (
                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    {editing ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 focus-within:border-[#FFBC5D] transition-colors">
                        <Globe size={13} className="text-gray-400 flex-shrink-0" />
                        <input
                          value={form.website}
                          onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))}
                          placeholder="https://yourstudio.com"
                          className="flex-1 text-sm text-gray-700 focus:outline-none bg-transparent"
                        />
                      </div>
                    ) : displayWebsite ? (
                      <a
                        href={displayWebsite.startsWith("http") ? displayWebsite : `https://${displayWebsite}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-gray-600 hover:text-[#F25722] transition-colors"
                      >
                        <Globe size={13} className="flex-shrink-0" />
                        <span className="truncate">{displayWebsite.replace(/^https?:\/\//, "")}</span>
                      </a>
                    ) : null}
                    {instagram && !editing && (
                      <a
                        href={instagram.startsWith("http") ? instagram : `https://instagram.com/${instagram.replace("@", "")}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-gray-600 hover:text-[#ec008c] transition-colors"
                      >
                        <Instagram size={13} className="flex-shrink-0" />
                        <span>{instagram.startsWith("@") ? instagram : `@${instagram}`}</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Get in Touch CTA */}
                {!editing && (
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <Link href="/login">
                      <a className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#111] hover:bg-gray-800 transition-colors">
                        Get in Touch
                      </a>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Boost modal */}
      {boostJobId !== null && (
        <BoostJobModal
          jobId={boostJobId}
          jobTitle={boostJobTitle}
          open={boostJobId !== null}
          onClose={() => setBoostJobId(null)}
        />
      )}
    </div>
  );
}
