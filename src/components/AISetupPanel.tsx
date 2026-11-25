import React, { useState } from 'react';
import { buildAnalystInputPayload } from '../ict/engine';
import { getSymbolContractSpec, calculatePositionSize, checkSignalEligibility } from '../ict/risk';
import type {
  AIAnalysisResult,
  CSNRRuleConfig,
  NewsRiskLevel,
  PersistedSignal,
  RiskSettings,
  StructuredSetupPayload,
} from '../ict/types';

interface AISetupPanelProps {
  setup: StructuredSetupPayload | null;
  aiResult: AIAnalysisResult | null;
  aiError: string | null;
  isAnalyzing: boolean;
  language: 'en' | 'km';
  onChangeLanguage: (lang: 'en' | 'km') => void;
  csnrRule: CSNRRuleConfig;
  onChangeCsnrRule: (rule: CSNRRuleConfig) => void;
  newsRisk: NewsRiskLevel;
  onChangeNewsRisk: (risk: NewsRiskLevel) => void;
  onRunAIAnalysis: () => void;
  onSaveSignal: (signal: PersistedSignal) => void;
  riskSettings: RiskSettings;
  existingSignals: PersistedSignal[];
}

export const AISetupPanel: React.FC<AISetupPanelProps> = ({
  setup,
  aiResult,
  aiError,
  isAnalyzing,
  language,
  onChangeLanguage,
  csnrRule,
  onChangeCsnrRule,
  newsRisk,
  onChangeNewsRisk,
  onRunAIAnalysis,
  onSaveSignal,
  riskSettings,
  existingSignals,
}) => {
  const [inspectorMode, setInspectorMode] = useState<'summary' | 'json' | 'csnr'>('summary');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  if (!setup) {
    return (
      <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 p-5 space-y-3">
        <h2 className="font-display text-sm font-semibold text-slate-100">
          ICT Setup Inspector
        </h2>
        <p className="text-xs leading-relaxed text-slate-400">
          No aligned multi-timeframe setup is active on the current closed candle. Switch replay scenarios, adjust the timeframe, or inspect the Market Feed tab.
        </p>
      </div>
    );
  }

  const spec = getSymbolContractSpec(setup.symbol);
  const sizing = calculatePositionSize({
    symbol: setup.symbol,
    accountBalance: riskSettings.accountBalance,
    riskPercent: riskSettings.riskPercent,
    entryPrice: setup.entry_price,
    stopLoss: setup.stop_loss,
    takeProfit: setup.take_profit,
    minRR: riskSettings.minRR,
  });

  const eligibility = checkSignalEligibility({
    setup,
    existingSignals,
    settings: riskSettings,
  });

  const analystInput = buildAnalystInputPayload(setup, {
    language,
    csnrRule,
    newsRisk,
  });

  const handleLogSignal = () => {
    setSaveFeedback(null);
    if (!eligibility.allowed) {
      setSaveFeedback(eligibility.reasons[0]);
      return;
    }

    const newSignal: PersistedSignal = {
      id: `sig-${setup.symbol}-${setup.timeframe_entry}-${setup.candle_time}`,
      symbol: setup.symbol,
      timeframe: setup.timeframe_entry,
      direction: setup.direction,
      entryPrice: setup.entry_price,
      stopLoss: setup.stop_loss,
      takeProfit: setup.take_profit,
      rrRatio: sizing.rrRatio,
      recommendedLots: sizing.recommendedLots,
      riskAmount: sizing.riskAmount,
      aiGrade: aiResult ? aiResult.grade : 'Rules-Only',
      aiScore: aiResult ? aiResult.score : null,
      explanation:
        aiResult?.explanation_en ||
        aiResult?.explanation ||
        `Rules engine detected ${setup.direction.toUpperCase()} ICT setup during ${setup.session_label}.`,
      khmerSummary: aiResult?.explanation_km || aiResult?.khmer_summary,
      sessionLabel: setup.session_label,
      htfBias: setup.htf_bias,
      status: 'Active',
      candleTime: setup.candle_time,
      createdAt: new Date().toISOString(),
      setupSnapshot: setup,
    };

    onSaveSignal(newSignal);
    setSaveFeedback('Signal saved to ledger.');
  };

  const gradeColor =
    aiResult?.grade === 'A'
      ? 'text-emerald-400'
      : aiResult?.grade === 'B'
      ? 'text-sky-400'
      : aiResult?.grade === 'C'
      ? 'text-amber-400'
      : 'text-rose-400';

  const biasColor =
    aiResult?.bias_alignment === 'aligned'
      ? 'text-emerald-400'
      : aiResult?.bias_alignment === 'conflicting'
      ? 'text-rose-400'
      : 'text-slate-300';

  return (
    <aside className="space-y-4">
      {/* Structured Rules Engine Output */}
      <div className="rounded-md border border-slate-800 bg-[#0F172A]/80 p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-slate-400">
              {setup.symbol} · {setup.timeframe_entry} · {setup.session_label}
            </p>
            <h2 className="mt-0.5 font-display text-lg font-semibold text-slate-100">
              {setup.direction === 'long' ? 'Bullish Long Setup' : 'Bearish Short Setup'}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                setInspectorMode((m) => (m === 'csnr' ? 'summary' : 'csnr'))
              }
              className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                inspectorMode === 'csnr'
                  ? 'border-sky-400 bg-sky-400/15 text-sky-300'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              CSNR &amp; News
            </button>
            <button
              type="button"
              onClick={() =>
                setInspectorMode((m) => (m === 'json' ? 'summary' : 'json'))
              }
              className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                inspectorMode === 'json'
                  ? 'border-sky-400 bg-sky-400/15 text-sky-300'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {inspectorMode === 'json' ? 'Summary' : 'Setup JSON'}
            </button>
          </div>
        </div>

        {inspectorMode === 'json' ? (
          <pre className="max-h-72 overflow-auto rounded border border-slate-800 bg-[#0B1120] p-3 font-mono text-[11px] leading-relaxed text-slate-300">
            {JSON.stringify(analystInput, null, 2)}
          </pre>
        ) : inspectorMode === 'csnr' ? (
          <div className="space-y-3 rounded border border-slate-800 bg-[#0B1120] p-3.5 text-xs">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-slate-300">
                News Risk Context
              </label>
              <div className="grid grid-cols-3 gap-1 rounded border border-slate-800 bg-[#0F172A] p-1">
                {(['none', 'low', 'high'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onChangeNewsRisk(lvl)}
                    className={`rounded py-1 text-[11px] font-medium capitalize transition-colors ${
                      newsRisk === lvl
                        ? lvl === 'high'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="csnr-def"
                className="block text-[11px] font-medium text-slate-300"
              >
                CSNR Definition (optional)
              </label>
              <input
                id="csnr-def"
                type="text"
                value={csnrRule.definition}
                onChange={(e) =>
                  onChangeCsnrRule({ ...csnrRule, definition: e.target.value })
                }
                placeholder="e.g., Candle S/R rejection closing back inside level"
                className="w-full rounded border border-slate-700 bg-[#0F172A] px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="csnr-eval"
                className="block text-[11px] font-medium text-slate-300"
              >
                CSNR Confirmation &amp; Invalidation Rules
              </label>
              <textarea
                id="csnr-eval"
                rows={2}
                value={csnrRule.evaluationRules}
                onChange={(e) =>
                  onChangeCsnrRule({ ...csnrRule, evaluationRules: e.target.value })
                }
                placeholder="e.g., Wick rejection >= 0.4 at nearest S/R; invalidates on full body close through level"
                className="w-full rounded border border-slate-700 bg-[#0F172A] px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="csnr-fit"
                className="block text-[11px] font-medium text-slate-300"
              >
                Where CSNR Fits in Grade
              </label>
              <select
                id="csnr-fit"
                value={csnrRule.gradeFit}
                onChange={(e) =>
                  onChangeCsnrRule({
                    ...csnrRule,
                    gradeFit: e.target.value as CSNRRuleConfig['gradeFit'],
                  })
                }
                className="w-full rounded border border-slate-700 bg-[#0F172A] px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-400 focus:outline-none"
              >
                <option value="confluence">Confluence (boosts A/B score)</option>
                <option value="confirmation">Entry Confirmation</option>
                <option value="hard_requirement">Hard Requirement (reject if missing)</option>
              </select>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 border-y border-slate-800/90 py-3 font-mono tabular-nums">
              <div>
                <p className="font-sans text-[11px] text-slate-400">Entry</p>
                <p className="mt-0.5 text-sm font-semibold text-sky-400">
                  {setup.entry_price.toFixed(spec.decimals)}
                </p>
              </div>
              <div>
                <p className="font-sans text-[11px] text-slate-400">Stop Loss</p>
                <p className="mt-0.5 text-sm font-semibold text-rose-400">
                  {setup.stop_loss.toFixed(spec.decimals)}
                </p>
              </div>
              <div>
                <p className="font-sans text-[11px] text-slate-400">Take Profit</p>
                <p className="mt-0.5 text-sm font-semibold text-emerald-400">
                  {setup.take_profit.toFixed(spec.decimals)}
                </p>
              </div>
            </div>

            {/* Rules Checklist */}
            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-400">HTF / MTF Alignment</dt>
                <dd className="font-mono text-slate-200 capitalize">
                  {setup.htf_bias} / {setup.mtf_structure}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-400">Liquidity Sweep</dt>
                <dd className="font-mono text-slate-200 text-right">
                  {setup.setup.sweep || 'None detected'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-400">Structure Shift</dt>
                <dd className="font-mono text-slate-200">
                  {setup.setup.choch
                    ? 'CHoCH Confirmed'
                    : setup.setup.bos
                    ? 'BOS Continuation'
                    : 'Pending'}
                  {setup.setup.displacement_confirmed ? ' · Displ.' : ''}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-400">Fair Value Gap</dt>
                <dd className="font-mono text-slate-200">
                  {setup.setup.fvg
                    ? `${setup.setup.fvg.range[0].toFixed(spec.decimals)} – ${setup.setup.fvg.range[1].toFixed(spec.decimals)}`
                    : 'None active'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-400">Dealing Range</dt>
                <dd className="font-mono text-slate-200">
                  {setup.setup.in_discount ? 'Discount' : 'Premium'}
                  {setup.setup.in_ote ? ' · In OTE' : ''}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-400">Risk / Sizing</dt>
                <dd className="font-mono text-slate-200">
                  {sizing.rrRatio.toFixed(2)}:1 · {sizing.recommendedLots.toFixed(2)} lots (${sizing.riskAmount})
                </dd>
              </div>
            </dl>
          </>
        )}

        {/* AI Grading Section */}
        <div className="border-t border-slate-800 pt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-slate-100">
              AI Setup Grade
            </h3>

            <div className="flex items-center gap-1 rounded border border-slate-800 bg-[#0B1120] p-0.5">
              <button
                type="button"
                onClick={() => onChangeLanguage('en')}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  language === 'en'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => onChangeLanguage('km')}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  language === 'km'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ខ្មែរ (KM)
              </button>
            </div>
          </div>

          {isAnalyzing ? (
            <div className="space-y-2 rounded border border-slate-800 bg-[#0B1120] p-3 animate-pulse">
              <div className="h-4 w-28 rounded bg-slate-800" />
              <div className="h-3 w-full rounded bg-slate-800" />
              <div className="h-3 w-4/5 rounded bg-slate-800" />
            </div>
          ) : aiError ? (
            <div className="rounded border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200 space-y-2">
              <p>{aiError}</p>
              <button
                type="button"
                onClick={onRunAIAnalysis}
                className="font-medium text-rose-300 underline hover:text-rose-100"
              >
                Retry AI Grading
              </button>
            </div>
          ) : aiResult ? (
            <div
              data-testid="ai-grade-result"
              className="rounded border border-slate-800 bg-[#0B1120] p-3.5 space-y-2.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className={`font-display text-2xl font-bold capitalize ${gradeColor}`}>
                    {aiResult.grade === 'reject' ? 'Reject' : `Grade ${aiResult.grade}`}
                  </span>
                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    {aiResult.score}/100
                  </span>
                </div>
                <span className={`font-mono text-[11px] capitalize ${biasColor}`}>
                  Bias: {aiResult.bias_alignment}
                </span>
              </div>

              <p className="text-xs leading-relaxed text-slate-200">
                {aiResult.explanation_en || aiResult.explanation}
              </p>

              {(aiResult.explanation_km || aiResult.khmer_summary) && (
                <p className="border-t border-slate-800/80 pt-2 text-xs leading-relaxed text-sky-200">
                  {aiResult.explanation_km || aiResult.khmer_summary}
                </p>
              )}

              {aiResult.confluences.length > 0 && (
                <div className="text-[11px]">
                  <span className="font-medium text-emerald-400">Confluences: </span>
                  <span className="text-slate-300">
                    {aiResult.confluences.join(' · ')}
                  </span>
                </div>
              )}

              {aiResult.missing_elements && aiResult.missing_elements.length > 0 && (
                <div className="text-[11px]">
                  <span className="font-medium text-slate-400">Missing: </span>
                  <span className="text-slate-300">
                    {aiResult.missing_elements.join(' · ')}
                  </span>
                </div>
              )}

              {aiResult.risks.length > 0 && (
                <div className="text-[11px]">
                  <span className="font-medium text-amber-400">Risks: </span>
                  <span className="text-slate-300">
                    {aiResult.risks.join(' · ')}
                  </span>
                </div>
              )}

              {aiResult.invalidation && (
                <div className="text-[11px] border-t border-slate-800/80 pt-2">
                  <span className="font-medium text-rose-400">Invalidation: </span>
                  <span className="font-mono text-slate-300">{aiResult.invalidation}</span>
                </div>
              )}

              {aiResult.disclaimer && (
                <p className="text-[10px] leading-snug text-slate-500">
                  {aiResult.disclaimer}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded border border-slate-800 bg-[#0B1120] p-3.5 text-xs text-slate-400 flex items-center justify-between gap-3">
              <span>Run Gemini grading on this structured setup.</span>
              <button
                type="button"
                onClick={onRunAIAnalysis}
                className="rounded bg-slate-800 px-3 py-1.5 font-medium text-slate-100 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                Analyze Now
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onRunAIAnalysis}
            disabled={isAnalyzing}
            className="flex-1 rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-60 transition-colors"
          >
            {isAnalyzing ? 'Analyzing...' : 'Re-Grade AI'}
          </button>
          <button
            type="button"
            onClick={handleLogSignal}
            className="flex-1 rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
          >
            Log Signal
          </button>
        </div>

        {!eligibility.allowed && (
          <p className="text-[11px] text-amber-400">
            Risk Gate Notice: {eligibility.reasons[0]}
          </p>
        )}
        {saveFeedback && (
          <p className="text-[11px] text-sky-300">{saveFeedback}</p>
        )}
      </div>
    </aside>
  );
};

