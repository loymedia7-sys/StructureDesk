import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { PersistedSignal } from '../ict/types';
import { getSymbolContractSpec } from '../ict/risk';

interface SignalLogTableProps {
  signals: PersistedSignal[];
  onUpdateStatus: (id: string, status: PersistedSignal['status']) => void;
  onDeleteSignal: (id: string) => void;
  onInspectSignal: (signal: PersistedSignal) => void;
}

export const SignalLogTable: React.FC<SignalLogTableProps> = ({
  signals,
  onUpdateStatus,
  onDeleteSignal,
  onInspectSignal,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
      if (
        searchQuery.trim() &&
        !s.symbol.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
        !s.sessionLabel.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [signals, filterStatus, searchQuery]);

  return (
    <section
      aria-labelledby="signal-log-heading"
      className="border-t border-slate-800 pt-6"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="signal-log-heading"
            className="font-display text-base font-semibold text-slate-100"
          >
            Signal Ledger
          </h2>
          <p className="text-xs text-slate-400">
            Persisted setups passing risk and cooldown rules · {signals.length} recorded
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter symbol or session..."
            aria-label="Filter logged signals"
            className="h-9 rounded-md border border-slate-800 bg-[#0F172A] px-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
          />

          <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-[#0F172A] p-1">
            {(['ALL', 'Active', 'TP Hit', 'SL Hit'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  filterStatus === status
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {status === 'ALL' ? 'All' : status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-slate-800 bg-[#0F172A]/60 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-300">
            No signals match the current filter
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Grade a detected ICT setup above and save it to track execution outcomes, cooldowns, and daily risk limits.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-800 bg-[#0F172A]/60">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="px-3 py-2.5 font-medium">Pair / TF</th>
                <th className="px-3 py-2.5 font-medium">Side</th>
                <th className="px-3 py-2.5 font-medium text-right">Entry</th>
                <th className="px-3 py-2.5 font-medium text-right">Stop Loss</th>
                <th className="px-3 py-2.5 font-medium text-right">Target</th>
                <th className="px-3 py-2.5 font-medium text-right">R:R</th>
                <th className="px-3 py-2.5 font-medium text-right">Lots</th>
                <th className="px-3 py-2.5 font-medium">Grade</th>
                <th className="px-3 py-2.5 font-medium">Session</th>
                <th className="px-3 py-2.5 font-medium">Outcome</th>
                <th className="px-3 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filtered.map((sig) => {
                const dec = getSymbolContractSpec(sig.symbol).decimals;
                const isLong = sig.direction === 'long';
                return (
                  <tr
                    key={sig.id}
                    className="h-10 transition-colors hover:bg-slate-800/35"
                  >
                    <td className="px-3 py-2 font-medium text-slate-100 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectSignal(sig)}
                        className="hover:text-sky-400 transition-colors text-left"
                      >
                        {sig.symbol}{' '}
                        <span className="text-slate-400 font-normal">
                          · {sig.timeframe}
                        </span>
                      </button>
                    </td>
                    <td
                      className={`px-3 py-2 font-mono font-semibold whitespace-nowrap ${
                        isLong ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isLong ? 'LONG' : 'SHORT'}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-right text-slate-200">
                      {sig.entryPrice.toFixed(dec)}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-right text-rose-400">
                      {sig.stopLoss.toFixed(dec)}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-right text-emerald-400">
                      {sig.takeProfit.toFixed(dec)}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-right text-slate-200">
                      {sig.rrRatio.toFixed(2)}:1
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-right text-slate-300">
                      {sig.recommendedLots.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-200 whitespace-nowrap">
                      {sig.aiGrade}
                      {sig.aiScore !== null ? ` (${sig.aiScore})` : ''}
                    </td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                      {sig.sessionLabel}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <select
                        aria-label={`Update status for ${sig.symbol} ${sig.direction} signal`}
                        value={sig.status}
                        onChange={(e) =>
                          onUpdateStatus(
                            sig.id,
                            e.target.value as PersistedSignal['status']
                          )
                        }
                        className="rounded border border-slate-700 bg-[#0B1120] px-2 py-1 text-xs text-slate-200 focus:border-sky-400 focus:outline-none"
                      >
                        <option value="Active">Active</option>
                        <option value="TP Hit">TP Hit</option>
                        <option value="SL Hit">SL Hit</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteSignal(sig.id)}
                        aria-label={`Delete signal ${sig.symbol} ${sig.direction}`}
                        className="inline-flex items-center justify-center rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
