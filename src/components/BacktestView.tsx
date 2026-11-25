import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AreaSeries, ColorType, createChart, type UTCTimestamp } from 'lightweight-charts';
import { runBacktest } from '../ict/backtest';
import { generateBacktestDataset } from '../ict/candles';
import { getSymbolContractSpec } from '../ict/risk';
import type { BacktestReport, MarketSymbol, Timeframe } from '../ict/types';

interface BacktestViewProps {
  initialSymbol: MarketSymbol;
  initialTimeframe: Timeframe;
}

export const BacktestView: React.FC<BacktestViewProps> = ({
  initialSymbol,
  initialTimeframe,
}) => {
  const [symbol, setSymbol] = useState<MarketSymbol>(initialSymbol);
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [minRR, setMinRR] = useState(2.0);
  const [riskPercent, setRiskPercent] = useState(1.0);
  const [startingBalance, setStartingBalance] = useState(10000);
  const [requireKillzone, setRequireKillzone] = useState(false);
  const [requireHTFAlignment, setRequireHTFAlignment] = useState(false);
  const [barCount, setBarCount] = useState(320);

  const [report, setReport] = useState<BacktestReport>(() => {
    const ds = generateBacktestDataset({
      symbol: initialSymbol,
      timeframe: initialTimeframe,
      count: 320,
    });
    return runBacktest({
      ltfCandles: ds.ltfCandles,
      mtfCandles: ds.mtfCandles,
      htfCandles: ds.htfCandles,
      config: {
        symbol: initialSymbol,
        timeframe: initialTimeframe,
        minRR: 2.0,
        requireKillzone: false,
        requireHTFAlignment: false,
        riskPercent: 1.0,
        startingBalance: 10000,
        cooldownCandles: 10,
      },
    });
  });

  const handleRunBacktest = () => {
    const ds = generateBacktestDataset({
      symbol,
      timeframe,
      count: barCount,
    });
    const nextReport = runBacktest({
      ltfCandles: ds.ltfCandles,
      mtfCandles: ds.mtfCandles,
      htfCandles: ds.htfCandles,
      config: {
        symbol,
        timeframe,
        minRR,
        requireKillzone,
        requireHTFAlignment,
        riskPercent,
        startingBalance,
        cooldownCandles: 10,
      },
    });
    setReport(nextReport);
  };

  const chartHostRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ReturnType<ReturnType<typeof createChart>['addSeries']> | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  useEffect(() => {
    const host = chartHostRef.current;
    if (!host) return;

    let disposed = false;

    const chart = createChart(host, {
      width: Math.max(300, host.clientWidth),
      height: 240,
      layout: {
        background: { type: ColorType.Solid, color: '#0B1120' },
        textColor: '#94A3B8',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.4)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.4)' },
      },
      rightPriceScale: { borderColor: 'rgba(30, 41, 59, 0.8)' },
      timeScale: { borderColor: 'rgba(30, 41, 59, 0.8)', timeVisible: true },
    });

    const area = chart.addSeries(AreaSeries, {
      lineColor: '#38BDF8',
      topColor: 'rgba(56, 189, 248, 0.25)',
      bottomColor: 'rgba(56, 189, 248, 0.02)',
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = area;

    const ro = new ResizeObserver((entries) => {
      if (disposed) return;
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) {
          try {
            chart.applyOptions({ width: w });
          } catch {
            // Ignore disposed chart
          }
        }
      }
    });
    ro.observe(host);

    return () => {
      disposed = true;
      ro.disconnect();
      seriesRef.current = null;
      chartRef.current = null;
      setTimeout(() => {
        try {
          chart.remove();
        } catch {
          // Ignore already-disposed instance
        }
      }, 0);
    };
  }, []);

  useEffect(() => {
    const area = seriesRef.current;
    const chart = chartRef.current;
    if (!area || !chart) return;

    const uniquePoints: { time: UTCTimestamp; value: number }[] = [];
    let prevTime = -Infinity;
    for (const pt of report.equityCurve) {
      const t = pt.time > prevTime ? pt.time : prevTime + 60;
      prevTime = t;
      uniquePoints.push({ time: t as UTCTimestamp, value: pt.balance });
    }
    area.setData(uniquePoints);
    chart.timeScale().fitContent();
  }, [report]);

  const spec = useMemo(() => getSymbolContractSpec(report.config.symbol), [report.config.symbol]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-100">
            Zero-Lookahead Historical Backtester
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Replays closed candles bar-by-bar through the multi-timeframe ICT engine to measure win rate, expectancy, and drawdown.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunBacktest}
          className="rounded-md bg-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-300 transition-colors whitespace-nowrap shrink-0 self-start"
        >
          Run Backtest Replay
        </button>
      </div>

      {/* Controls Bar */}
      <div className="grid grid-cols-2 gap-4 rounded-md border border-slate-800 bg-[#0F172A]/70 p-4 sm:grid-cols-4 lg:grid-cols-7">
        <div>
          <label htmlFor="bt-symbol" className="block text-xs text-slate-400 mb-1">
            Symbol
          </label>
          <select
            id="bt-symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value as MarketSymbol)}
            className="w-full rounded border border-slate-700 bg-[#0B1120] px-2.5 py-1.5 text-xs text-slate-100"
          >
            <option value="XAUUSD">XAUUSD</option>
            <option value="EURUSD">EURUSD</option>
            <option value="GBPUSD">GBPUSD</option>
            <option value="USDJPY">USDJPY</option>
            <option value="BTCUSDT">BTCUSDT</option>
          </select>
        </div>

        <div>
          <label htmlFor="bt-tf" className="block text-xs text-slate-400 mb-1">
            Entry TF
          </label>
          <select
            id="bt-tf"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
            className="w-full rounded border border-slate-700 bg-[#0B1120] px-2.5 py-1.5 text-xs text-slate-100"
          >
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1H">1H</option>
          </select>
        </div>

        <div>
          <label htmlFor="bt-bars" className="block text-xs text-slate-400 mb-1">
            History Bars
          </label>
          <select
            id="bt-bars"
            value={barCount}
            onChange={(e) => setBarCount(Number(e.target.value))}
            className="w-full rounded border border-slate-700 bg-[#0B1120] px-2.5 py-1.5 font-mono text-xs text-slate-100"
          >
            <option value={240}>240 bars</option>
            <option value={320}>320 bars</option>
            <option value={480}>480 bars</option>
          </select>
        </div>

        <div>
          <label htmlFor="bt-rr" className="block text-xs text-slate-400 mb-1">
            Min R:R
          </label>
          <input
            id="bt-rr"
            type="number"
            min={1.5}
            max={5}
            step={0.5}
            value={minRR}
            onChange={(e) => setMinRR(Number(e.target.value) || 2)}
            className="w-full rounded border border-slate-700 bg-[#0B1120] px-2.5 py-1.5 font-mono text-xs text-slate-100"
          />
        </div>

        <div>
          <label htmlFor="bt-risk" className="block text-xs text-slate-400 mb-1">
            Risk %
          </label>
          <input
            id="bt-risk"
            type="number"
            min={0.25}
            max={3}
            step={0.25}
            value={riskPercent}
            onChange={(e) => setRiskPercent(Number(e.target.value) || 1)}
            className="w-full rounded border border-slate-700 bg-[#0B1120] px-2.5 py-1.5 font-mono text-xs text-slate-100"
          />
        </div>

        <div>
          <label htmlFor="bt-balance" className="block text-xs text-slate-400 mb-1">
            Start Capital
          </label>
          <input
            id="bt-balance"
            type="number"
            min={1000}
            step={1000}
            value={startingBalance}
            onChange={(e) => setStartingBalance(Number(e.target.value) || 10000)}
            className="w-full rounded border border-slate-700 bg-[#0B1120] px-2.5 py-1.5 font-mono text-xs text-slate-100"
          />
        </div>

        <div className="flex flex-col justify-center gap-2 text-xs text-slate-300">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={requireHTFAlignment}
              onChange={(e) => setRequireHTFAlignment(e.target.checked)}
              className="rounded border-slate-700 bg-[#0B1120] text-sky-400"
            />
            <span>HTF Bias Filter</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={requireKillzone}
              onChange={(e) => setRequireKillzone(e.target.checked)}
              className="rounded border-slate-700 bg-[#0B1120] text-sky-400"
            />
            <span>Killzones Only</span>
          </label>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 p-3.5">
          <p className="text-xs text-slate-400">Win Rate</p>
          <p
            data-testid="bt-winrate"
            className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-100"
          >
            {report.winRate}%
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {report.wins}W / {report.losses}L ({report.totalTrades} trades)
          </p>
        </div>

        <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 p-3.5">
          <p className="text-xs text-slate-400">Expectancy</p>
          <p
            className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
              report.expectancyR >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {report.expectancyR >= 0 ? '+' : ''}
            {report.expectancyR}R
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Per trade</p>
        </div>

        <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 p-3.5">
          <p className="text-xs text-slate-400">Average Win R:R</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-100">
            {report.avgRR}:1
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Profit Factor {report.profitFactor}</p>
        </div>

        <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 p-3.5">
          <p className="text-xs text-slate-400">Max Drawdown</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-amber-400">
            {report.maxDrawdownPct > 0 ? `-${report.maxDrawdownPct}%` : '0.00%'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Peak-to-trough</p>
        </div>

        <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 p-3.5">
          <p className="text-xs text-slate-400">Net Return</p>
          <p
            className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
              report.netReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {report.netReturnPct >= 0 ? '+' : ''}
            {report.netReturnPct}%
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Closed equity</p>
        </div>

        <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 p-3.5">
          <p className="text-xs text-slate-400">Final Balance</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-100">
            ${report.finalBalance.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            From ${report.config.startingBalance.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Equity Curve */}
      <div className="rounded-md border border-slate-800 bg-[#0B1120] p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-display font-semibold text-slate-200">
            Equity Curve ({report.config.symbol} · {report.config.timeframe})
          </span>
          <span className="font-mono text-slate-400">
            Zero look-ahead bias · Conservative SL-first tie-break
          </span>
        </div>
        <div ref={chartHostRef} className="h-[240px] w-full" />
      </div>

      {/* Trade Ledger */}
      <div className="overflow-x-auto rounded-md border border-slate-800 bg-[#0F172A]/70">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Entry (UTC)</th>
              <th className="px-3 py-2.5 font-medium">Direction</th>
              <th className="px-3 py-2.5 font-medium text-right">Entry</th>
              <th className="px-3 py-2.5 font-medium text-right">SL</th>
              <th className="px-3 py-2.5 font-medium text-right">TP</th>
              <th className="px-3 py-2.5 font-medium">Confluences</th>
              <th className="px-3 py-2.5 font-medium text-right">R-Mult</th>
              <th className="px-3 py-2.5 font-medium text-right">PnL</th>
              <th className="px-3 py-2.5 font-medium text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
            {report.trades.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center font-sans text-slate-400">
                  No trades satisfied the current filters. Try lowering Min R:R or disabling the Killzones-only toggle.
                </td>
              </tr>
            ) : (
              report.trades.map((tr, idx) => (
                <tr key={tr.id} className="h-9 hover:bg-slate-800/35">
                  <td className="px-3 py-1.5 text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-1.5 text-slate-300 whitespace-nowrap">
                    {new Date(tr.entryTime * 1000).toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td
                    className={`px-3 py-1.5 font-semibold ${
                      tr.direction === 'long' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {tr.direction.toUpperCase()}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-200">
                    {tr.entryPrice.toFixed(spec.decimals)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-rose-400">
                    {tr.stopLoss.toFixed(spec.decimals)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-emerald-400">
                    {tr.takeProfit.toFixed(spec.decimals)}
                  </td>
                  <td className="px-3 py-1.5 font-sans text-slate-400 whitespace-nowrap">
                    {tr.confluences.join(' · ')}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right font-semibold ${
                      tr.outcome === 'win' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {tr.rMultiple > 0 ? `+${tr.rMultiple}R` : `${tr.rMultiple}R`}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right ${
                      tr.pnlDollar >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {tr.pnlDollar >= 0 ? `+$${tr.pnlDollar}` : `-$${Math.abs(tr.pnlDollar)}`}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-200">
                    ${tr.balanceAfter.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
