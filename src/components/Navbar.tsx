import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const Navbar: React.FC = () => {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return null; // When logged in, WorkspaceView's TopBar is the sole header
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B1120]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
        >
          <img src="/logo.png" alt="StructureDesk Logo" className="h-7 w-auto object-contain" />
          <span>StructureDesk</span>
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-6 overflow-x-auto">
          <Link
            to="/about"
            className="text-sm font-medium text-slate-300 hover:text-sky-400 transition-colors whitespace-nowrap"
          >
            About &amp; Beta
          </Link>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded bg-slate-800" />
          ) : (
            <Link
              to="/login"
              className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
