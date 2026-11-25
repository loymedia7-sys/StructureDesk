import React, { useState } from 'react';
import { parseCandlesInput, type ReplayScenarioId } from '../ict/candles';
import { getSymbolContractSpec } from '../ict/risk';
import type { Candle, MarketSymbol, Timeframe } from '../ict/types';

interface MarketFeedViewProps {
  symbol: MarketSymbol;
  timeframe: Timeframe;
  feedMode: 'replay' | 'live' | 'custom';
  feedProvider: string;
  feedWarning: string | null;
  scenario: ReplayScenarioId;
  candles: Candle[];
  onChangeFeedMode: (mode: 'replay' | 'live') => void;
  onChangeScenario: (scenario: ReplayScenarioId) => void;
  onImportCustomCandles: (candles: Candle[]) => void;
}

export const MarketFeedView: React.FC<MarketFeedViewProps> = ({
  symbol,
  timeframe,
  feedMode,
  feedProvider,
  feedWarning,
  scenario,
  candles,
  onChangeFeedMode,
  onChangeScenario,
  onImportCustomCandles,
}) => {
  const [csvInput, setCsvInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const spec = getSymbolContractSpec(symbol);
  const recentCandles = [...candles].slice(-25).reverse();

  const handleLoadSampleCsv = () => {
    const sample = [
      'time,open,high,low,close,volume',
      ...candles
        .slice(-30)
        .map(
          (c) =>
            `${c.time},${c.open.toFixed(spec.decimals)},${c.high.toFixed(
              spec.decimals
            )},${c.low.toFixed(spec.decimals)},${c.close.toFixed(
              spec.decimals
            )},${c.volume}`
        ),
    ].join('\n');
    setCsvInput(sample);
    setParseError(null);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setParseError(null);
    setImportNotice(null);
    try {
      const parsed = parseCandlesInput(csvInput);
      onImportCustomCandles(parsed);
      setImportNotice(`Loaded ${parsed.length} closed candles into the ICT engine.`);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Unable to parse OHLCV candle data.'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-100">
            Market Data &amp; Closed-Candle Store
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Inspect closed OHLCV bars feeding the ICT rules engine, switch between real-time streaming quotes and institutional replay scenarios, or import broker CSV candles.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-[#0F172A] p-1 self-start">
          <button
            type="button"
            onClick={() => onChangeFeedMode('replay')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              feedMode === 'replay'
                ? 'bg-sky-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            Replay Store
          </button>
          <button
            type="button"
            onClick={() => onChangeFeedMode('live')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              feedMode === 'live'
                ? 'bg-emerald-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            Live Real-Time
          </button>
        </div>
      </div>

      {feedWarning && (
        <div className="rounded-md border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-200">
          {feedWarning}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Scenario & CSV Import */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 p-5">
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Active Feed Source
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {symbol} · {timeframe} · {feedProvider} · {candles.length} closed bars
            </p>

            <div className="mt-4 space-y-2">
              <label
                htmlFor="scenario-select"
                className="block text-xs font-medium text-slate-300"
              >
                Institutional Replay Scenario
              </label>
              <select
                id="scenario-select"
                value={scenario}
                onChange={(e) =>
                  onChangeScenario(e.target.value as ReplayScenarioId)
                }
                className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
              >
                <option value="london_bullish_sweep">
                  London Killzone · Sell-Side Sweep + Bullish CHoCH + FVG
                </option>
                <option value="ny_bearish_ote">
                  New York Killzone · Buy-Side Sweep + Bearish OTE + FVG
                </option>
                <option value="london_bos_continuation">
                  London Continuation · Bullish BOS + Discount Order Block
                </option>
              </select>
            </div>
          </div>

          <form
            onSubmit={handleApplyCustom}
            className="rounded-md border border-slate-800 bg-[#0F172A]/70 p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-slate-100">
                Import Broker OHLCV (CSV or JSON)
              </h2>
              <button
                type="button"
                onClick={handleLoadSampleCsv}
                className="text-xs font-medium text-sky-400 hover:text-sky-300 whitespace-nowrap"
              >
                Load Current Bars
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Paste MT5, OANDA, or Binance closed candle exports (`time,open,high,low,close,volume`).
            </p>
            <textarea
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              rows={7}
              aria-label="CSV or JSON OHLCV candle data"
              placeholder="time,open,high,low,close,volume&#10;1795600200,2634.10,2636.40,2633.50,2635.90,1240"
              className="w-full rounded-md border border-slate-700 bg-[#0B1120] p-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none"
            />
            {parseError && (
              <p className="text-xs text-rose-400">{parseError}</p>
            )}
            {importNotice && (
              <p className="text-xs text-emerald-400">{importNotice}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-md bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-white transition-colors"
            >
              Load Candles Into ICT Engine
            </button>
          </form>
        </div>

        {/* Right: Closed Candle Table */}
        <div className="lg:col-span-7">
          <div className="overflow-x-auto rounded-md border border-slate-800 bg-[#0F172A]/70">
            <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-100">
                Latest Closed Candles (UTC)
              </h2>
              <span className="font-mono text-xs text-slate-400">
                Unfinished candles excluded
              </span>
            </div>
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="px-3 py-2.5 font-medium">Time (UTC)</th>
                  <th className="px-3 py-2.5 font-medium text-right">Open</th>
                  <th className="px-3 py-2.5 font-medium text-right">High</th>
                  <th className="px-3 py-2.5 font-medium text-right">Low</th>
                  <th className="px-3 py-2.5 font-medium text-right">Close</th>
                  <th className="px-3 py-2.5 font-medium text-right">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {recentCandles.map((c) => {
                  const bullish = c.close >= c.open;
                  const dt = new Date(c.time * 1000)
                    .toISOString()
                    .replace('T', ' ')
                    .slice(0, 16);
                  return (
                    <tr key={c.time} className="h-9 hover:bg-slate-800/35">
                      <td className="px-3 py-1.5 text-slate-300 whitespace-nowrap">
                        {dt}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-300">
                        {c.open.toFixed(spec.decimals)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-300">
                        {c.high.toFixed(spec.decimals)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-300">
                        {c.low.toFixed(spec.decimals)}
                      </td>
                      <td
                        className={`px-3 py-1.5 text-right font-medium ${
                          bullish ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {c.close.toFixed(spec.decimals)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-400">
                        {c.volume.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
