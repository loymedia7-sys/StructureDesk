import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, subtext, trend }) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0F172A]/70 p-5 backdrop-blur-sm space-y-2 shadow-lg">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-display text-2xl font-bold tracking-tight text-slate-100 tabular-nums">
          {value}
        </h4>
        {trend && (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-400 font-medium">
            {trend}
          </span>
        )}
      </div>
      {subtext && <p className="text-[11px] text-slate-500">{subtext}</p>}
    </div>
  );
};
