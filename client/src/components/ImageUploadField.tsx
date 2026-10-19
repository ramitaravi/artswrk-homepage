/**
 * Pick an image from the machine, or paste a URL.
 *
 * The admin artist form asked for a "Profile Picture URL", which meant
 * uploading the photo somewhere else first and pasting a link back. The file
 * goes to the same storage every other upload uses and the field keeps the
 * returned URL, so what gets saved is unchanged — only how it is obtained.
 */
import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const MAX_BYTES = 8 * 1024 * 1024;

export default function ImageUploadField({
  value,
  onChange,
  folder = "profile-pictures",
  label = "Profile Picture",
  fallbackInitial = "?",
  round = true,
}: {
  value: string;
  onChange: (url: string) => void;
  folder?: "profile-pictures" | "affiliation-logos";
  label?: string;
  fallbackInitial?: string;
  round?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showUrl, setShowUrl] = useState(false);
  const upload = trpc.admin.uploadImage.useMutation({
    onSuccess: ({ url }) => onChange(url),
    onError: (e: any) => toast.error(e.message || "Upload failed"),
  });

  async function handleFile(file: File | null) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error(`That image is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is 8MB.`);
      return;
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    upload.mutate({ base64, contentType: file.type || "image/png", filename: file.name, folder });
  }

  return (
    <div className="flex items-start gap-4">
      <div className={`w-16 h-16 ${round ? "rounded-full" : "rounded-xl"} bg-gradient-to-br from-[#FFBC5D] to-[#F25722] flex items-center justify-center text-white font-black text-xl flex-shrink-0 overflow-hidden`}>
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span>{fallbackInitial.toUpperCase()}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-dashed border-gray-300 text-xs font-semibold text-gray-600 hover:border-[#F25722] hover:text-[#F25722] transition-colors disabled:opacity-50"
          >
            {upload.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {upload.isPending ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-red-500 transition-colors"
            >
              <X size={12} /> Remove
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowUrl((v) => !v)}
            className="text-xs font-semibold text-gray-400 hover:text-[#111] underline underline-offset-2 transition-colors"
          >
            {showUrl ? "Hide URL" : "Paste a URL instead"}
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => { handleFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
        />

        {showUrl && (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://…"
            className="mt-2 w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#F25722] transition-colors bg-white"
          />
        )}
      </div>
    </div>
  );
}
