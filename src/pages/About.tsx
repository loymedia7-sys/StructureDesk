import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Sparkles, CheckCircle2 } from "lucide-react";

export const About: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-10">
      <div className="space-y-4 border-b border-slate-800 pb-6">
        <span className="rounded-full bg-sky-500/10 border border-sky-500/30 px-3 py-1 text-xs font-medium text-sky-300">
          AI Architecture &amp; Beta Information
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-100">
          About SMC Signal AI &amp; Beta Program
        </h1>
        <p className="text-sm sm:text-base leading-relaxed text-slate-300">
          StructureDesk combines rigorous, deterministic ICT/SMC rules engines with advanced Gemini reasoning models. The rules engine identifies objective market telemetry, and the AI evaluates confluence quality.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-[#0F172A]/70 p-6 space-y-4">
          <h3 className="font-display text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-sky-400" /> Core Concepts Evaluated
          </h3>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> Higher-Timeframe Bias (4H / Daily)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> Market Structure (BOS &amp; CHoCH)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> Liquidity Sweeps &amp; Resting Stops (BSL/SSL)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> Fair Value Gaps (FVG) &amp; Order Blocks
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> Dealing Range Premium / Discount &amp; OTE
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> London and New York Killzone Timing
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0F172A]/70 p-6 space-y-4">
          <h3 className="font-display text-lg font-semibold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" /> Free Beta Testing
          </h3>
          <p className="text-sm leading-relaxed text-slate-300">
            StructureDesk is currently in <strong>Free Beta</strong> while we scale real-time institutional feed integrations and optimize our multi-model AI grading fallback pipeline.
          </p>
          <p className="text-sm leading-relaxed text-slate-400">
            All registered Google traders enjoy unrestricted access to the Signal Desk, Backtester, and AI grading during this test period.
          </p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors"
            >
              Sign In with Google
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5 text-xs leading-relaxed text-amber-200/90">
        <strong>Risk Disclaimer:</strong> Market analysis, AI grades, and backtest reports provided by StructureDesk are for informational and educational purposes only and do not constitute financial advice. Trading forex and crypto involves substantial risk of loss.
      </div>
    </div>
  );
};
