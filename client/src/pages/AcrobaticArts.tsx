import { StudioJobWizard } from "@/components/StudioJobWizard";

export default function AcrobaticArts() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-[Poppins,sans-serif]">

      {/* ── Left panel: brand image ── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#111] items-end justify-start p-12 overflow-hidden flex-shrink-0">
        {/* Background image */}
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663410355144/AyEgFhxRkEopXHz25XyihS/artist-strip-1-aY8po4fr7wkR7kHuYcLRjW.webp"
          alt="Acrobatic Arts"
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

        {/* Branding */}
        <div className="relative z-10">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3">Artswrk × Acrobatic Arts</p>
          <h1 className="text-4xl font-black text-white leading-tight mb-4">
            Hire Acrobatic<br />Arts Instructors
          </h1>
          <p className="text-white/70 text-sm max-w-xs leading-relaxed">
            Post your job in seconds. Our AI builds your listing and sends it to 6,000+ vetted artists nationwide.
          </p>

          <div className="flex items-center gap-6 mt-8">
            <div>
              <p className="text-2xl font-black text-white">6,000+</p>
              <p className="text-xs text-white/60">Vetted artists</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-2xl font-black text-white">Free</p>
              <p className="text-xs text-white/60">To post a job</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-2xl font-black text-white">3</p>
              <p className="text-xs text-white/60">Avg. applicants / 24h</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-16 lg:px-14 bg-white">
        {/* Mobile header */}
        <div className="lg:hidden text-center mb-8">
          <p className="text-xs font-semibold text-[#F25722] uppercase tracking-widest mb-2">Artswrk × Acrobatic Arts</p>
          <h1 className="text-3xl font-black text-[#111]">Hire Acrobatic Arts Instructors</h1>
        </div>

        <div className="w-full max-w-md mx-auto">
          <StudioJobWizard
            heading="Post a Job in Minutes"
            subheading="Free to post · Powered by AI · 6,000+ artists"
            businessType="Acrobatic Arts Studio"
          />
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Already have an account?{" "}
          <a href="/login" className="text-[#F25722] font-semibold hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
