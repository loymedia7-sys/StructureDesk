import { useCallback, useEffect, useMemo, useState } from 'react';
import { TopBar, type WorkspaceTab } from './components/TopBar';
import {
  SMCCandleChart,
  type OverlayVisibility,
} from './components/SMCCandleChart';
import { TradingViewEmbed } from './components/TradingViewEmbed';
import { AISetupPanel } from './components/AISetupPanel';
import { SignalLogTable } from './components/SignalLogTable';
import { MarketFeedView } from './components/MarketFeedView';
import { BacktestView } from './components/BacktestView';
import { RiskRulesView } from './components/RiskRulesView';
import {
  generateInstitutionalDataset,
  SYMBOL_BASE_CONFIG,
  type ReplayScenarioId,
} from './ict/candles';
import { evaluateMultiTimeframeSetup } from './ict/engine';
import type {
  AIAnalysisResult,
  CSNRRuleConfig,
  Candle,
  MarketSymbol,
  NewsRiskLevel,
  PersistedSignal,
  RiskSettings,
  Timeframe,
} from './ict/types';

const CSNR_STORAGE_KEY = 'structuredesk_csnr_rule_v1';

const DEFAULT_CSNR_RULE: CSNRRuleConfig = {
  definition: '',
  evaluationRules: '',
  gradeFit: 'confluence',
};

const SYMBOLS: MarketSymbol[] = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT'];
const TIMEFRAMES: Timeframe[] = ['5m', '15m', '1H', '4H'];

const DEFAULT_RISK_SETTINGS: RiskSettings = {
  accountBalance: 10000,
  riskPercent: 1.0,
  minRR: 2.0,
  cooldownCandles: 12,
  dailyLossLimitPercent: 3.0,
  maxOpenSignals: 3,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('desk');
  const [symbol, setSymbol] = useState<MarketSymbol>('XAUUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const [scenario, setScenario] = useState<ReplayScenarioId>('london_bullish_sweep');
  const [feedMode, setFeedMode] = useState<'replay' | 'live' | 'custom'>('live');
  const [feedProvider, setFeedProvider] = useState('Connecting Real-Time Stream...');
  const [feedWarning, setFeedWarning] = useState<string | null>(null);
  const [formingCandle, setFormingCandle] = useState<Candle | null>(null);
  const [liveQuote, setLiveQuote] = useState<{ bid: number; ask: number } | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [lastTickTime, setLastTickTime] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<'smc' | 'tradingview'>('smc');
  const [language, setLanguage] = useState<'en' | 'km'>('en');
  const [newsRisk, setNewsRisk] = useState<NewsRiskLevel>('none');
  const [csnrRule, setCsnrRule] = useState<CSNRRuleConfig>(() => {
    try {
      const saved = localStorage.getItem(CSNR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<CSNRRuleConfig>;
        return {
          definition: typeof parsed.definition === 'string' ? parsed.definition : '',
          evaluationRules:
            typeof parsed.evaluationRules === 'string' ? parsed.evaluationRules : '',
          gradeFit:
            parsed.gradeFit === 'confirmation' || parsed.gradeFit === 'hard_requirement'
              ? parsed.gradeFit
              : 'confluence',
        };
      }
    } catch {
      // ignore storage failure
    }
    return DEFAULT_CSNR_RULE;
  });

  useEffect(() => {
    try {
      localStorage.setItem(CSNR_STORAGE_KEY, JSON.stringify(csnrRule));
    } catch {
      // ignore storage failure
    }
  }, [csnrRule]);

  const [overlays, setOverlays] = useState<OverlayVisibility>({
    fvg: true,
    orderBlocks: true,
    structure: true,
    liquidity: true,
    dealingRange: true,
  });

  // Initialize synchronously with deterministic closed candles so first paint is immediate
  const initialDataset = useMemo(
    () =>
      generateInstitutionalDataset({
        symbol: 'XAUUSD',
        timeframe: '5m',
        count: 160,
        scenario: 'london_bullish_sweep',
      }),
    []
  );

  const [ltfCandles, setLtfCandles] = useState<Candle[]>(initialDataset.ltfCandles);
  const [mtfCandles, setMtfCandles] = useState<Candle[]>(initialDataset.mtfCandles);
  const [htfCandles, setHtfCandles] = useState<Candle[]>(initialDataset.htfCandles);

  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [signals, setSignals] = useState<PersistedSignal[]>([]);
  const [riskSettings, setRiskSettings] = useState<RiskSettings>(DEFAULT_RISK_SETTINGS);

  // Load persisted signals on mount
  useEffect(() => {
    fetch('/api/signals')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.signals)) {
          setSignals(data.signals);
        }
      })
      .catch(() => {
        // Ignore network transient errors on initial load
      });
  }, []);

  // Subscribe to real-time SSE market stream whenever feedMode === 'live'
  useEffect(() => {
    if (feedMode !== 'live') {
      setStreamConnected(false);
      setFormingCandle(null);
      setLiveQuote(null);
      return;
    }

    let cancelled = false;
    setAiResult(null);
    setAiError(null);
    setFeedWarning(null);
    setFormingCandle(null);
    setLiveQuote(null);
    setStreamConnected(false);
    setFeedProvider('Connecting Real-Time Stream...');

    const params = new URLSearchParams({ symbol, timeframe });
    const eventSource = new EventSource(`/api/stream?${params.toString()}`);

    eventSource.addEventListener('snapshot', (event: MessageEvent) => {
      if (cancelled) return;
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data.ltfCandles) && data.ltfCandles.length > 0) {
          setLtfCandles(data.ltfCandles);
        }
        if (Array.isArray(data.mtfCandles) && data.mtfCandles.length > 0) {
          setMtfCandles(data.mtfCandles);
        }
        if (Array.isArray(data.htfCandles) && data.htfCandles.length > 0) {
          setHtfCandles(data.htfCandles);
        }
        setFormingCandle(data.formingCandle ?? null);
        if (typeof data.bid === 'number' && typeof data.ask === 'number') {
          setLiveQuote({ bid: data.bid, ask: data.ask });
        } else {
          setLiveQuote(null);
        }
        setFeedProvider(data.provider || 'Real-Time Stream');
        setStreamConnected(true);
        setLastTickTime(typeof data.serverTime === 'number' ? data.serverTime : Date.now());
        setFeedWarning(null);
      } catch {
        // Ignore malformed snapshot frame
      }
    });

    eventSource.addEventListener('tick', (event: MessageEvent) => {
      if (cancelled) return;
      try {
        const data = JSON.parse(event.data);
        setFormingCandle(data.formingCandle ?? null);
        if (typeof data.bid === 'number' && typeof data.ask === 'number') {
          setLiveQuote({ bid: data.bid, ask: data.ask });
        }
        setStreamConnected(true);
        setLastTickTime(typeof data.serverTime === 'number' ? data.serverTime : Date.now());

        if (data.closedCandle && typeof data.closedCandle.time === 'number') {
          const closedBar = data.closedCandle as Candle;
          setLtfCandles((prev) => {
            const exists = prev.some((c) => c.time === closedBar.time);
            const next = exists
              ? prev.map((c) => (c.time === closedBar.time ? closedBar : c))
              : [...prev, closedBar];
            return next.sort((a, b) => a.time - b.time).slice(-160);
          });
        }
      } catch {
        // Ignore malformed tick frame
      }
    });

    eventSource.addEventListener('fallback', (event: MessageEvent) => {
      if (cancelled) return;
      try {
        const data = JSON.parse(event.data);
        setFeedMode('replay');
        setStreamConnected(false);
        setFormingCandle(null);
        setFeedProvider(data.provider || 'Institutional Replay Fallback');
        setFeedWarning(
          data.warning || 'Live stream unavailable. Showing deterministic closed-candle replay.'
        );
        if (Array.isArray(data.ltfCandles)) setLtfCandles(data.ltfCandles);
        if (Array.isArray(data.mtfCandles)) setMtfCandles(data.mtfCandles);
        if (Array.isArray(data.htfCandles)) setHtfCandles(data.htfCandles);
      } catch {
        // Ignore malformed fallback frame
      }
      eventSource.close();
    });

    eventSource.onerror = () => {
      if (cancelled) return;
      setStreamConnected(false);
    };

    return () => {
      cancelled = true;
      eventSource.close();
    };
  }, [feedMode, symbol, timeframe]);

  // Fetch replay candles when feedMode === 'replay'
  const loadCandles = useCallback(
    async (
      targetSymbol: MarketSymbol,
      targetTf: Timeframe,
      targetScenario: ReplayScenarioId
    ) => {
      setAiResult(null);
      setAiError(null);
      setFeedWarning(null);
      setFormingCandle(null);
      setStreamConnected(false);

      try {
        const params = new URLSearchParams({
          symbol: targetSymbol,
          timeframe: targetTf,
          source: 'replay',
          scenario: targetScenario,
        });
        const res = await fetch(`/api/candles?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Feed request failed (${res.status})`);
        }
        const data = await res.json();
        setLtfCandles(data.ltfCandles);
        setMtfCandles(data.mtfCandles);
        setHtfCandles(data.htfCandles);
        setFeedProvider(data.provider || 'Closed-Candle Store');
        if (data.warning) {
          setFeedWarning(data.warning);
        }
      } catch {
        const localFallback = generateInstitutionalDataset({
          symbol: targetSymbol,
          timeframe: targetTf,
          count: 160,
          scenario: targetScenario,
        });
        setLtfCandles(localFallback.ltfCandles);
        setMtfCandles(localFallback.mtfCandles);
        setHtfCandles(localFallback.htfCandles);
        setFeedProvider('Local Institutional Replay');
      }
    },
    []
  );

  const handleSelectSymbol = (nextSymbol: MarketSymbol) => {
    setSymbol(nextSymbol);
    setAiResult(null);
    setAiError(null);
    if (feedMode === 'custom') {
      setFeedMode('live');
    } else if (feedMode === 'replay') {
      loadCandles(nextSymbol, timeframe, scenario);
    }
  };

  const handleSelectTimeframe = (nextTf: Timeframe) => {
    setTimeframe(nextTf);
    setAiResult(null);
    setAiError(null);
    if (feedMode === 'custom') {
      setFeedMode('live');
    } else if (feedMode === 'replay') {
      loadCandles(symbol, nextTf, scenario);
    }
  };

  const handleChangeFeedMode = (nextMode: 'replay' | 'live') => {
    setFeedMode(nextMode);
    setAiResult(null);
    setAiError(null);
    if (nextMode === 'replay') {
      loadCandles(symbol, timeframe, scenario);
    }
  };

  const handleChangeScenario = (nextScenario: ReplayScenarioId) => {
    setScenario(nextScenario);
    setFeedMode('replay');
    loadCandles(symbol, timeframe, nextScenario);
  };

  const handleImportCustomCandles = (imported: Candle[]) => {
    setFeedMode('custom');
    setFeedProvider('Custom Imported OHLCV');
    setFeedWarning(null);
    setFormingCandle(null);
    setStreamConnected(false);
    setLastTickTime(null);
    setLtfCandles(imported);
    setMtfCandles(imported);
    setHtfCandles(imported);
    setAiResult(null);
    setAiError(null);
    setActiveTab('desk');
  };

  // Run pure deterministic ICT/SMC engine over current closed candles
  const evaluation = useMemo(() => {
    return evaluateMultiTimeframeSetup({
      symbol,
      entryTimeframe: timeframe,
      htfCandles,
      mtfCandles,
      ltfCandles,
      requireHTFAlignment: false,
    });
  }, [symbol, timeframe, htfCandles, mtfCandles, ltfCandles]);

  const handleRunAIAnalysis = async () => {
    if (!evaluation.setup) return;
    setActiveTab('desk');
    setIsAnalyzing(true);
    setAiError(null);

    try {
      const res = await fetch('/api/analyze-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup: evaluation.setup,
          language,
          csnrRule,
          newsRisk,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI grading request failed.');
      }
      setAiResult(data as AIAnalysisResult);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to reach AI analysis service.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveSignal = async (signal: PersistedSignal) => {
    try {
      const res = await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal),
      });
      if (res.ok) {
        const data = await res.json();
        setSignals(data.signals);
        return;
      }
    } catch {
      // Fallback to local state if API unavailable
    }
    setSignals((prev) => [signal, ...prev.filter((s) => s.id !== signal.id)]);
  };

  const handleUpdateSignalStatus = async (
    id: string,
    status: PersistedSignal['status']
  ) => {
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    try {
      await fetch(`/api/signals/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch {
      // Optimistic update preserved
    }
  };

  const handleDeleteSignal = async (id: string) => {
    setSignals((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/signals/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch {
      // Optimistic delete preserved
    }
  };

  const handleInspectSignal = (signal: PersistedSignal) => {
    setSymbol(signal.symbol);
    setTimeframe(signal.timeframe);
    setActiveTab('desk');
    if (feedMode === 'custom') {
      setFeedMode('live');
    } else if (feedMode === 'replay') {
      loadCandles(signal.symbol, signal.timeframe, scenario);
    }
  };

  const { ltfAnalysis, htfBias, mtfStructure, setup } = evaluation;
  const activeFvgs = ltfAnalysis.fvgs.filter((f) => !f.mitigated).length;
  const activeObs = ltfAnalysis.orderBlocks.filter((o) => !o.mitigated).length;
  const recentSweeps = ltfAnalysis.sweeps.length;

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onAnalyzeSetup={handleRunAIAnalysis}
        isAnalyzing={isAnalyzing}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        <div className={activeTab === 'desk' ? 'space-y-6' : 'hidden'}>
            {/* Workspace Toolbar */}
            <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                {/* Symbol Selector */}
                <div
                  role="group"
                  aria-label="Select trading symbol"
                  className="flex items-center gap-1 rounded-md border border-slate-800 bg-[#0F172A] p-1"
                >
                  {SYMBOLS.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => handleSelectSymbol(sym)}
                      className={`rounded px-2.5 py-1 text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
                        symbol === sym
                          ? 'bg-slate-800 text-sky-400'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>

                {/* Timeframe Selector */}
                <div
                  role="group"
                  aria-label="Select entry timeframe"
                  className="flex items-center gap-1 rounded-md border border-slate-800 bg-[#0F172A] p-1"
                >
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => handleSelectTimeframe(tf)}
                      className={`rounded px-2.5 py-1 text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
                        timeframe === tf
                          ? 'bg-slate-800 text-slate-100'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                {/* Live Stream / Replay Segmented Switch */}
                <div
                  role="group"
                  aria-label="Select market feed mode"
                  className="flex items-center gap-1 rounded-md border border-slate-800 bg-[#0F172A] p-1"
                >
                  <button
                    type="button"
                    onClick={() => handleChangeFeedMode('live')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      feedMode === 'live'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Live Real-Time
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeFeedMode('replay')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      feedMode === 'replay'
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Replay
                  </button>
                </div>

                {/* Scenario Quick Selector (Replay mode only) */}
                {feedMode === 'replay' && (
                  <select
                    aria-label="Select replay scenario"
                    value={scenario}
                    onChange={(e) =>
                      handleChangeScenario(e.target.value as ReplayScenarioId)
                    }
                    className="h-8 rounded-md border border-slate-800 bg-[#0F172A] px-2.5 text-xs text-slate-300 focus:border-sky-400 focus:outline-none"
                  >
                    <option value="london_bullish_sweep">
                      Scenario: London Bullish Sweep
                    </option>
                    <option value="ny_bearish_ote">
                      Scenario: NY Bearish OTE
                    </option>
                    <option value="london_bos_continuation">
                      Scenario: London BOS Continuation
                    </option>
                  </select>
                )}
              </div>

              {/* Chart Mode & SMC Overlay Toggles */}
              <div className="flex flex-wrap items-center gap-3">
                {chartMode === 'smc' && (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    {(
                      [
                        ['fvg', 'FVG'],
                        ['orderBlocks', 'Order Blocks'],
                        ['structure', 'BOS / CHoCH'],
                        ['liquidity', 'Sweeps'],
                        ['dealingRange', 'OTE 62–79%'],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="inline-flex items-center gap-1.5 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={overlays[key]}
                          onChange={(e) =>
                            setOverlays((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                          className="rounded border-slate-700 bg-[#0F172A] text-sky-400 focus:ring-sky-400"
                        />
                        <span className="whitespace-nowrap">{label}</span>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-[#0F172A] p-1">
                  <button
                    type="button"
                    onClick={() => setChartMode('smc')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      chartMode === 'smc'
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    SMC Canvas
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('tradingview')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      chartMode === 'tradingview'
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    TradingView Widget
                  </button>
                </div>
              </div>
            </div>

            {feedWarning && (
              <div className="rounded-md border border-amber-500/40 bg-amber-950/30 px-4 py-2.5 text-xs text-amber-200">
                {feedWarning}
              </div>
            )}

            {/* Multi-Timeframe Confluence Strip */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 px-4 py-3">
                <p className="text-xs text-slate-400">HTF Bias (4H / Daily)</p>
                <p
                  data-testid="htf-bias"
                  className={`mt-1 font-display text-base font-semibold capitalize ${
                    htfBias === 'bullish'
                      ? 'text-emerald-400'
                      : htfBias === 'bearish'
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }`}
                >
                  {htfBias}
                </p>
              </div>

              <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 px-4 py-3">
                <p className="text-xs text-slate-400">MTF Structure (1H)</p>
                <p
                  className={`mt-1 font-display text-base font-semibold capitalize ${
                    mtfStructure === 'bullish'
                      ? 'text-emerald-400'
                      : mtfStructure === 'bearish'
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }`}
                >
                  {mtfStructure}
                </p>
              </div>

              <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 px-4 py-3">
                <p className="text-xs text-slate-400">Active Killzone (UTC)</p>
                <p
                  className={`mt-1 font-display text-base font-semibold ${
                    ltfAnalysis.killzone.inKillzone
                      ? 'text-sky-400'
                      : 'text-slate-300'
                  }`}
                >
                  {ltfAnalysis.killzone.label}
                </p>
              </div>

              <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 px-4 py-3">
                <p className="text-xs text-slate-400">Dealing Range</p>
                <p className="mt-1 font-display text-base font-semibold capitalize text-slate-100">
                  {ltfAnalysis.dealingRange
                    ? `${ltfAnalysis.dealingRange.zone} · ${ltfAnalysis.dealingRange.retracementPct.toFixed(
                        0
                      )}%`
                    : 'Calculating'}
                </p>
              </div>
            </div>

            {/* Primary 2-Column Workspace: Chart + AI Setup Panel */}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-8">
                {chartMode === 'smc' ? (
                  <SMCCandleChart
                    symbol={symbol}
                    candles={ltfCandles}
                    formingCandle={formingCandle}
                    liveQuote={liveQuote}
                    isLiveStream={feedMode === 'live' && streamConnected}
                    lastTickTime={lastTickTime}
                    analysis={ltfAnalysis}
                    setup={setup}
                    overlays={overlays}
                  />
                ) : (
                  <TradingViewEmbed symbol={symbol} timeframe={timeframe} />
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
                  <span>
                    {SYMBOL_BASE_CONFIG[symbol].label} · Feed: {feedProvider}
                  </span>
                  <span className="font-mono tabular-nums text-slate-300">
                    Active Zones: {activeFvgs} Unmitigated FVG · {activeObs} Order Blocks · {recentSweeps} Sweeps
                  </span>
                </div>
              </div>

              <div className="lg:col-span-4">
                <AISetupPanel
                  setup={setup}
                  aiResult={aiResult}
                  aiError={aiError}
                  isAnalyzing={isAnalyzing}
                  language={language}
                  onChangeLanguage={setLanguage}
                  csnrRule={csnrRule}
                  onChangeCsnrRule={setCsnrRule}
                  newsRisk={newsRisk}
                  onChangeNewsRisk={setNewsRisk}
                  onRunAIAnalysis={handleRunAIAnalysis}
                  onSaveSignal={handleSaveSignal}
                  riskSettings={riskSettings}
                  existingSignals={signals}
                />
              </div>
            </div>

            {/* Signal Ledger */}
            <SignalLogTable
              signals={signals}
              onUpdateStatus={handleUpdateSignalStatus}
              onDeleteSignal={handleDeleteSignal}
              onInspectSignal={handleInspectSignal}
            />
        </div>

        {activeTab === 'feed' && (
          <MarketFeedView
            symbol={symbol}
            timeframe={timeframe}
            feedMode={feedMode}
            feedProvider={feedProvider}
            feedWarning={feedWarning}
            scenario={scenario}
            candles={ltfCandles}
            onChangeFeedMode={handleChangeFeedMode}
            onChangeScenario={handleChangeScenario}
            onImportCustomCandles={handleImportCustomCandles}
          />
        )}

        {activeTab === 'backtest' && (
          <BacktestView initialSymbol={symbol} initialTimeframe={timeframe} />
        )}

        {activeTab === 'risk' && (
          <RiskRulesView
            symbol={symbol}
            settings={riskSettings}
            onUpdateSettings={setRiskSettings}
            signals={signals}
            defaultEntry={setup?.entry_price ?? 2635.0}
            defaultStopLoss={setup?.stop_loss ?? 2630.0}
            defaultTakeProfit={setup?.take_profit ?? 2650.0}
          />
        )}
      </main>
    </div>
  );
}
