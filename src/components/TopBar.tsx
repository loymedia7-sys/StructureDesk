import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export type WorkspaceTab = 'desk' | 'feed' | 'backtest' | 'risk';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onAnalyzeSetup: () => void;
  isAnalyzing: boolean;
}

const NAV_ITEMS: { id: WorkspaceTab; label: string }[] = [
  { id: 'desk', label: 'Signal Desk' },
  { id: 'feed', label: 'Market Feed' },
  { id: 'backtest', label: 'Backtester' },
  { id: 'risk', label: 'Risk & Rules' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onAnalyzeSetup,
  isAnalyzing,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B1120]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#desk"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('desk');
          }}
          className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
        >
          <img src="/logo.png" alt="StructureDesk Logo" className="h-7 w-auto object-contain" />
          <span>StructureDesk</span>
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav aria-label="Workspace sections" className="flex items-center gap-6 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  isActive
                    ? 'text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions + User Profile */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onAnalyzeSetup}
            disabled={isAnalyzing}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 rounded-md hover:bg-sky-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            {isAnalyzing ? 'Grading Setup...' : 'Grade With AI'}
          </button>

          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <img
                src={user.photoURL || "/favicon.png"}
                alt=""
                className="h-7 w-7 rounded-full border border-slate-700 object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => logout().then(() => navigate("/"))}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
