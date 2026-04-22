import { ReactNode } from "react";
import { Link } from "wouter";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  message?: string;
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, message, cta, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-14 px-6 text-center ${className}`}>
      <div className="text-gray-300 mb-3">{icon}</div>
      <p className="text-sm font-semibold text-gray-700 mb-1">{title}</p>
      {message && <p className="text-xs text-gray-400 mb-4 max-w-xs">{message}</p>}
      {cta && (
        cta.href ? (
          <Link
            href={cta.href}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity"
          >
            {cta.label}
          </Link>
        ) : (
          <button
            onClick={cta.onClick}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white bg-[#111] hover:opacity-80 transition-opacity"
          >
            {cta.label}
          </button>
        )
      )}
    </div>
  );
}
