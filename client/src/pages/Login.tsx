import { useLocation, useSearch } from "wouter";
import Navbar from "@/components/Navbar";
import InlineAuth, { type AuthResult } from "@/components/InlineAuth";

export default function Login() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const next = params.get("next");
  const prefillEmail = params.get("email") ?? "";
  const prefillRole = params.get("role");

  function getJoinUrl(email = prefillEmail) {
    const joinParams = new URLSearchParams();
    if (email) joinParams.set("email", email);
    if (next) joinParams.set("next", next);
    if (prefillRole === "client" || prefillRole === "artist") joinParams.set("role", prefillRole);
    const query = joinParams.toString();
    return `/join${query ? `?${query}` : ""}`;
  }

  function getDestination(data: AuthResult) {
    if (next) return next;
    if (data.isAdmin) return "/admin-dashboard";
    if (data.enterprise) return "/enterprise";
    return "/app";
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center px-4 pt-28 pb-12">
      <Navbar />

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <InlineAuth
            prefillEmail={prefillEmail}
            heading="Sign in"
            subheading="Enter your email to continue"
            onSuccess={(data) => { window.location.href = getDestination(data); }}
            onNotFound={(email) => {
              window.location.href = getJoinUrl(email);
            }}
          />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Don't have an account?{" "}
          <a
            href={getJoinUrl()}
            className="font-semibold text-[#F25722] hover:opacity-70 transition-opacity"
          >
            Join Now
          </a>
        </p>
      </div>
    </div>
  );
}
