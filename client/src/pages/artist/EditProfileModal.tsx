/**
 * EDIT PROFILE — Full-page view matching the live Artswrk edit profile design.
 * 4 tabs: About | Services | Resume | Media
 */

import { useState, useRef, useCallback } from "react";
import { ArrowLeft, Loader2, Upload, Trash2, Pencil, X, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ─── Artist Type definitions ──────────────────────────────────────────────────

const ARTIST_TYPES = [
  { name: "Dance Educator", subServices: ["Competition Choreography", "Substitute Teacher", "Recurring Classes", "Private Lessons", "Master Classes", "Event Choreography"] },
  { name: "Dance Adjudicator", subServices: ["Dance Competition Judge"] },
  { name: "Photographer", subServices: ["Event Photography", "Headshots", "Studio Photography", "On-Location Photography"] },
  { name: "Videographer", subServices: ["Event Videography", "Music Videos", "Promotional Videos", "Reels/Social Content"] },
  { name: "Acting Coach", subServices: ["Scene Study", "Audition Prep", "Cold Reading", "On-Camera Coaching"] },
  { name: "Vocal Coach", subServices: ["Private Lessons", "Group Classes", "Audition Prep", "Performance Coaching"] },
  { name: "Side Jobs", subServices: ["Brand Ambassador", "Event Staff", "Emcee", "Model"] },
  { name: "Music Teacher", subServices: ["Piano Lessons", "Guitar Lessons", "Drum Lessons", "Music Theory"] },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type SubServiceSetting = {
  name: string;
  listOnProfile: boolean;
  jobEmailEnabled: boolean;
};

type ServiceCategory = {
  id?: number;
  name: string;
  imageUrl: string;
  subServices: string[];
  subServiceSettings: SubServiceSetting[];
  sortOrder: number;
};

type ResumeFile = { url: string; name: string };

type ProfileData = {
  firstName: string;
  lastName: string;
  pronouns: string;
  phoneNumber: string;
  bio: string;
  location: string;
  profilePicture: string;
  website: string;
  instagram: string;
  mediaPhotos: string[];
  resumeFiles: ResumeFile[];
};

type EditTab = "about" | "services" | "resume" | "media";

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditProfilePageProps {
  onClose: () => void;
  initialTab?: EditTab;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EditProfilePage({ onClose, initialTab = "about" }: EditProfilePageProps) {
  const [activeTab, setActiveTab] = useState<EditTab>(initialTab);

  const { data: profile, isLoading: profileLoading } = trpc.artistProfile.getMyProfile.useQuery();
  const { data: serviceCategories, isLoading: servicesLoading } = trpc.artistProfile.getMyServiceCategories.useQuery();

  const updateProfile = trpc.artistProfile.updateMyProfile.useMutation();
  const updateServices = trpc.artistProfile.updateMyServiceCategories.useMutation();
  const uploadFile = trpc.artistProfile.uploadFile.useMutation();
  const utils = trpc.useUtils();

  // ── About form state ──────────────────────────────────────────────────────
  const [about, setAbout] = useState<ProfileData | null>(null);

  // Initialize about state from profile data
  if (profile && !about) {
    setAbout({
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      pronouns: profile.pronouns || "",
      phoneNumber: (profile as any).phoneNumber || "",
      bio: profile.bio || "",
      location: profile.location || "",
      profilePicture: profile.profilePicture || "",
      website: profile.website || "",
      instagram: profile.instagram || "",
      mediaPhotos: profile.mediaPhotos || [],
      resumeFiles: profile.resumeFiles || [],
    });
  }

  // ── Services state ────────────────────────────────────────────────────────
  const [services, setServices] = useState<ServiceCategory[] | null>(null);
  const [allEmailsDisabled, setAllEmailsDisabled] = useState(false);

  if (serviceCategories && !services) {
    const mapped: ServiceCategory[] = serviceCategories.map((cat, i) => {
      const subSettings: SubServiceSetting[] = cat.subServices.map(sub => ({
        name: sub,
        listOnProfile: true,
        jobEmailEnabled: true,
      }));
      return {
        id: cat.id,
        name: cat.name,
        imageUrl: cat.imageUrl || "",
        subServices: cat.subServices,
        subServiceSettings: subSettings,
        sortOrder: cat.sortOrder,
      };
    });
    setServices(mapped);
  }

  // ── File upload helpers ───────────────────────────────────────────────────
  const photoInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [editingResumeName, setEditingResumeName] = useState<number | null>(null);
  const [editResumeValue, setEditResumeValue] = useState("");

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !about) return;
    setUploadingPhoto(true);
    try {
      const base64 = await toBase64(file);
      const { url } = await uploadFile.mutateAsync({ base64, mimeType: file.type, fileName: file.name, folder: "profile-photos" });
      setAbout(prev => prev ? { ...prev, profilePicture: url } : prev);
      toast.success("Profile photo updated");
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !about) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("File too large (max 50 MB)"); return; }
    setUploadingResume(true);
    try {
      const base64 = await toBase64(file);
      const { url } = await uploadFile.mutateAsync({ base64, mimeType: file.type, fileName: file.name, folder: "resumes" });
      const newResume: ResumeFile = { url, name: file.name.replace(/\.[^/.]+$/, "") };
      setAbout(prev => prev ? { ...prev, resumeFiles: [...prev.resumeFiles, newResume] } : prev);
      toast.success("Resume uploaded");
    } catch {
      toast.error("Failed to upload resume");
    } finally {
      setUploadingResume(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !about) return;
    setUploadingMedia(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const base64 = await toBase64(file);
        const { url } = await uploadFile.mutateAsync({ base64, mimeType: file.type, fileName: file.name, folder: "media-photos" });
        urls.push(url);
      }
      setAbout(prev => prev ? { ...prev, mediaPhotos: [...prev.mediaPhotos, ...urls] } : prev);
      toast.success(`${urls.length} photo${urls.length > 1 ? "s" : ""} added`);
    } catch {
      toast.error("Failed to upload media");
    } finally {
      setUploadingMedia(false);
    }
  };

  // ── Save handlers ─────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  const handleSave = async (closeAfter = false) => {
    if (!about) return;
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        firstName: about.firstName,
        lastName: about.lastName,
        pronouns: about.pronouns,
        bio: about.bio,
        location: about.location,
        profilePicture: about.profilePicture,
        website: about.website,
        instagram: about.instagram,
        mediaPhotos: about.mediaPhotos,
        resumeFiles: about.resumeFiles,
      });

      if (services) {
        await updateServices.mutateAsync({ categories: services });
      }

      await utils.artistProfile.getMyProfile.invalidate();
      await utils.artistProfile.getMyServiceCategories.invalidate();
      toast.success("Profile saved");
      if (closeAfter) onClose();
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  // ── Artist Type toggles ───────────────────────────────────────────────────
  const toggleArtistType = (typeName: string) => {
    if (!services) return;
    const exists = services.find(s => s.name === typeName);
    if (exists) {
      setServices(services.filter(s => s.name !== typeName));
    } else {
      const typeConfig = ARTIST_TYPES.find(t => t.name === typeName);
      const newCat: ServiceCategory = {
        name: typeName,
        imageUrl: "",
        subServices: typeConfig?.subServices || [],
        subServiceSettings: (typeConfig?.subServices || []).map(sub => ({
          name: sub,
          listOnProfile: true,
          jobEmailEnabled: true,
        })),
        sortOrder: services.length,
      };
      setServices([...services, newCat]);
    }
  };

  const toggleSubServiceSetting = (catName: string, subName: string, field: "listOnProfile" | "jobEmailEnabled") => {
    if (!services) return;
    setServices(services.map(cat => {
      if (cat.name !== catName) return cat;
      return {
        ...cat,
        subServiceSettings: cat.subServiceSettings.map(s =>
          s.name === subName ? { ...s, [field]: !s[field] } : s
        ),
      };
    }));
  };

  const enabledEmailCount = services
    ? services.flatMap(c => c.subServiceSettings).filter(s => s.jobEmailEnabled).length
    : 0;

  if (profileLoading || servicesLoading || !about) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  const tabs: { id: EditTab; label: string }[] = [
    { id: "about", label: "About" },
    { id: "services", label: "Services" },
    { id: "resume", label: "Resume" },
    { id: "media", label: "Media" },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <button onClick={onClose} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-bold text-[#111] mb-4">Edit Profile</h1>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-pink-500"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* ── ABOUT TAB ─────────────────────────────────────────────────── */}
        {activeTab === "about" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#111]">About</h2>
              <p className="text-sm text-gray-500">Update your profile below</p>
            </div>

            {/* Profile Photo */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200">
                {about.profilePicture ? (
                  <img src={about.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-3xl font-bold">
                    {about.firstName?.[0] || "?"}
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500">Upload Profile Picture</p>
              <div className="flex gap-2">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : null}
                  Edit Profile Picture
                </button>
                {about.profilePicture && (
                  <button
                    onClick={() => setAbout(prev => prev ? { ...prev, profilePicture: "" } : prev)}
                    className="px-4 py-2 text-sm font-medium text-pink-500 border border-pink-200 rounded-lg hover:bg-pink-50 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>

            {/* First + Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={about.firstName}
                  onChange={e => setAbout(prev => prev ? { ...prev, firstName: e.target.value } : prev)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-pink-400 transition-colors"
                  placeholder="Ramita"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={about.lastName}
                  onChange={e => setAbout(prev => prev ? { ...prev, lastName: e.target.value } : prev)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-pink-400 transition-colors"
                  placeholder="Ravi"
                />
              </div>
            </div>

            {/* Pronouns + Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pronouns</label>
                <input
                  type="text"
                  value={about.pronouns}
                  onChange={e => setAbout(prev => prev ? { ...prev, pronouns: e.target.value } : prev)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-pink-400 transition-colors"
                  placeholder="She/Her/Hers"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={about.phoneNumber}
                  onChange={e => setAbout(prev => prev ? { ...prev, phoneNumber: e.target.value } : prev)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-pink-400 transition-colors"
                  placeholder="(724) 757-9944"
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={about.bio}
                onChange={e => setAbout(prev => prev ? { ...prev, bio: e.target.value } : prev)}
                rows={8}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-pink-400 transition-colors resize-none"
                placeholder="Tell hirers about yourself..."
              />
            </div>

            {/* Location */}
            <div>
              <h3 className="text-base font-bold text-[#111] mb-1">Location</h3>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Location</label>
              <input
                type="text"
                value={about.location}
                onChange={e => setAbout(prev => prev ? { ...prev, location: e.target.value } : prev)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-pink-400 transition-colors"
                placeholder="Santa Clarita, CA, USA"
              />
              <div className="mt-2 flex items-start gap-2 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <span className="text-orange-500 mt-0.5">🔔</span>
                <p className="text-xs text-orange-700">Traveling? Update your location to receive job notifications wherever you go.</p>
              </div>
            </div>

            {/* Links */}
            <div>
              <h3 className="text-base font-bold text-[#111] mb-3">Links</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input
                    type="url"
                    value={about.website}
                    onChange={e => setAbout(prev => prev ? { ...prev, website: e.target.value } : prev)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-pink-400 transition-colors"
                    placeholder="https://www.ramitaravi.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                  <input
                    type="text"
                    value={about.instagram}
                    onChange={e => setAbout(prev => prev ? { ...prev, instagram: e.target.value } : prev)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-pink-400 transition-colors"
                    placeholder="https://www.instagram.com/ramita.ravi/"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SERVICES TAB ──────────────────────────────────────────────── */}
        {activeTab === "services" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#111]">Services</h2>
              <p className="text-sm text-gray-500">Click on Artist Types below to add them to your profile, then select the specific services to be notified about.</p>
            </div>

            {/* Artist Type chips */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Artist Types</p>
              <div className="flex flex-wrap gap-2">
                {ARTIST_TYPES.map(type => {
                  const active = services?.some(s => s.name === type.name);
                  return (
                    <button
                      key={type.name}
                      onClick={() => toggleArtistType(type.name)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                        active
                          ? "bg-pink-500 text-white border-pink-500"
                          : "bg-white text-gray-700 border-gray-300 hover:border-pink-300"
                      }`}
                    >
                      {type.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Services list */}
            {services && services.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Services</p>
                <div className="space-y-1">
                  {services.map(cat => (
                    <div key={cat.name}>
                      {/* Category header */}
                      <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-lg mb-1">
                        <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-xs">🎭</div>
                        <span className="text-sm font-semibold text-gray-800">{cat.name}</span>
                      </div>
                      {/* Sub-services */}
                      {cat.subServiceSettings.map(sub => (
                        <div key={sub.name} className="flex items-center justify-between py-2.5 px-3 border-b border-gray-100">
                          <span className="text-sm text-gray-700">{sub.name}</span>
                          <div className="flex items-center gap-6">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs text-gray-400">List on Profile</span>
                              <button
                                onClick={() => toggleSubServiceSetting(cat.name, sub.name, "listOnProfile")}
                                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  sub.listOnProfile
                                    ? "bg-pink-500 border-pink-500 text-white"
                                    : "border-gray-300 text-transparent"
                                }`}
                              >
                                <Check size={14} />
                              </button>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs text-gray-400">Job Emails</span>
                              <button
                                onClick={() => toggleSubServiceSetting(cat.name, sub.name, "jobEmailEnabled")}
                                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  sub.jobEmailEnabled
                                    ? "bg-pink-500 border-pink-500 text-white"
                                    : "border-gray-300 text-transparent"
                                }`}
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email notification banner */}
            {enabledEmailCount > 0 && (
              <div className="flex items-center justify-between p-4 bg-pink-50 rounded-xl border border-pink-100">
                <div className="flex items-start gap-3">
                  <span className="text-pink-500 mt-0.5">✉️</span>
                  <div>
                    <p className="text-sm font-semibold text-pink-700">Turn off email notifications?</p>
                    <p className="text-xs text-pink-600">Email notifications are enabled for {enabledEmailCount} service{enabledEmailCount !== 1 ? "s" : ""}. Click the toggle to turn off notifications!</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-gray-500">Disable All</span>
                  <button
                    onClick={() => {
                      if (!services) return;
                      setAllEmailsDisabled(!allEmailsDisabled);
                      setServices(services.map(cat => ({
                        ...cat,
                        subServiceSettings: cat.subServiceSettings.map(s => ({
                          ...s,
                          jobEmailEnabled: allEmailsDisabled,
                        })),
                      })));
                    }}
                    className={`relative w-12 h-6 rounded-full transition-colors ${allEmailsDisabled ? "bg-pink-500" : "bg-gray-200"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${allEmailsDisabled ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RESUME TAB ────────────────────────────────────────────────── */}
        {activeTab === "resume" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#111]">Resumes</h2>
              <p className="text-sm text-gray-500">Upload your resume below. These will autosave to your profile so you can easily submit to jobs!</p>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => resumeInputRef.current?.click()}
              className="border-2 border-dashed border-pink-300 rounded-xl p-10 flex flex-col items-center gap-2 cursor-pointer hover:bg-pink-50 transition-colors"
            >
              {uploadingResume ? (
                <Loader2 size={32} className="text-pink-500 animate-spin" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center">
                  <Upload size={20} className="text-white" />
                </div>
              )}
              <p className="text-sm text-gray-600">
                Drag & drop or <span className="text-pink-500 font-medium">choose a file</span> to upload
              </p>
              <p className="text-xs text-gray-400">Max Size: 50 MB</p>
            </div>
            <input ref={resumeInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleResumeUpload} />

            {/* My Resumes list */}
            {about.resumeFiles.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">My Resumes</p>
                <div className="space-y-2">
                  {about.resumeFiles.map((resume, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-pink-500 text-sm">📄</span>
                      </div>
                      {editingResumeName === idx ? (
                        <input
                          autoFocus
                          value={editResumeValue}
                          onChange={e => setEditResumeValue(e.target.value)}
                          onBlur={() => {
                            const updated = [...about.resumeFiles];
                            updated[idx] = { ...updated[idx], name: editResumeValue };
                            setAbout(prev => prev ? { ...prev, resumeFiles: updated } : prev);
                            setEditingResumeName(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              const updated = [...about.resumeFiles];
                              updated[idx] = { ...updated[idx], name: editResumeValue };
                              setAbout(prev => prev ? { ...prev, resumeFiles: updated } : prev);
                              setEditingResumeName(null);
                            }
                          }}
                          className="flex-1 text-sm border-b border-pink-400 focus:outline-none"
                        />
                      ) : (
                        <span className="flex-1 text-sm text-gray-800 truncate">{resume.name}</span>
                      )}
                      <button
                        onClick={() => { setEditingResumeName(idx); setEditResumeValue(resume.name); }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => {
                          const updated = about.resumeFiles.filter((_, i) => i !== idx);
                          setAbout(prev => prev ? { ...prev, resumeFiles: updated } : prev);
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MEDIA TAB ─────────────────────────────────────────────────── */}
        {activeTab === "media" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#111]">Media</h2>
              <p className="text-sm text-gray-500">Upload your media below. These will appear on your profile!</p>
            </div>

            {/* Upload zone */}
            <div
              onClick={() => mediaInputRef.current?.click()}
              className="border-2 border-dashed border-pink-300 rounded-xl p-10 flex flex-col items-center gap-2 cursor-pointer hover:bg-pink-50 transition-colors"
            >
              {uploadingMedia ? (
                <Loader2 size={32} className="text-pink-500 animate-spin" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center">
                  <span className="text-white text-xl">🖼️</span>
                </div>
              )}
              <p className="text-sm text-gray-600 font-medium">Add Photos to my Artswrk Profile</p>
              <p className="text-xs text-gray-400">PRO Plan: Unlimited Photos</p>
            </div>
            <input ref={mediaInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleMediaUpload} />

            {/* My Photos grid */}
            {about.mediaPhotos.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">My Photos</p>
                <div className="grid grid-cols-3 gap-3">
                  {about.mediaPhotos.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
                      <img src={url} alt={`Media ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => {
                          const updated = about.mediaPhotos.filter((_, i) => i !== idx);
                          setAbout(prev => prev ? { ...prev, mediaPhotos: updated } : prev);
                        }}
                        className="absolute bottom-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                      >
                        <Trash2 size={14} className="text-gray-600 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Save Bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="px-6 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
          Save
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="px-6 py-2.5 text-sm font-bold text-white bg-[#111] rounded-lg hover:bg-gray-700 transition-colors"
        >
          Save & Close
        </button>
      </div>
    </div>
  );
}
