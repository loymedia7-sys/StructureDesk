import React, { useMemo, useState } from 'react';
import { calculatePositionSize } from '../ict/risk';
import type { MarketSymbol, PersistedSignal, RiskSettings } from '../ict/types';

interface RiskRulesViewProps {
  symbol: MarketSymbol;
  settings: RiskSettings;
  onUpdateSettings: (next: RiskSettings) => void;
  signals: PersistedSignal[];
  defaultEntry: number;
  defaultStopLoss: number;
  defaultTakeProfit: number;
}

export const RiskRulesView: React.FC<RiskRulesViewProps> = ({
  symbol,
  settings,
  onUpdateSettings,
  signals,
  defaultEntry,
  defaultStopLoss,
  defaultTakeProfit,
}) => {
  const [calcSymbol, setCalcSymbol] = useState<MarketSymbol>(symbol);
  const [entryPrice, setEntryPrice] = useState(String(defaultEntry));
  const [stopLoss, setStopLoss] = useState(String(defaultStopLoss));
  const [takeProfit, setTakeProfit] = useState(String(defaultTakeProfit));

  const [alertChannel, setAlertChannel] = useState<'webhook' | 'telegram'>('webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [alertStatus, setAlertStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [sendingAlert, setSendingAlert] = useState(false);

  const sizing = useMemo(() => {
    const e = Number(entryPrice);
    const sl = Number(stopLoss);
    const tp = Number(takeProfit);
    if (![e, sl, tp].every(Number.isFinite) || e <= 0) {
      return null;
    }
    return calculatePositionSize({
      symbol: calcSymbol,
      accountBalance: settings.accountBalance,
      riskPercent: settings.riskPercent,
      entryPrice: e,
      stopLoss: sl,
      takeProfit: tp,
      minRR: settings.minRR,
    });
  }, [calcSymbol, entryPrice, stopLoss, takeProfit, settings]);

  const activeSignalsCount = signals.filter((s) => s.status === 'Active').length;
  const maxDailyLoss = (
    settings.accountBalance *
    (settings.dailyLossLimitPercent / 100)
  ).toFixed(2);

  const handleSendTestAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingAlert(true);
    setAlertStatus(null);
    try {
      const text = `StructureDesk ICT Alert (${calcSymbol})\nEntry: ${entryPrice} | SL: ${stopLoss} | TP: ${takeProfit}\nRisk: $${sizing?.riskAmount ?? 0} (${sizing?.recommendedLots ?? 0} lots)`;
      const res = await fetch('/api/alerts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          alertChannel === 'telegram'
            ? {
                telegramBotToken: telegramToken,
                telegramChatId,
                messageText: text,
              }
            : {
                webhookUrl,
                messageText: text,
                payload: { symbol: calcSymbol, entryPrice, stopLoss, takeProfit },
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to deliver alert');
      }
      setAlertStatus({
        type: 'success',
        message: `Test alert delivered via ${data.channel}.`,
      });
    } catch (err) {
      setAlertStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Alert dispatch failed.',
      });
    } finally {
      setSendingAlert(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="font-display text-2xl font-semibold text-slate-100">
          Risk Management, Position Sizing &amp; Alerts
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Enforce minimum Reward-to-Risk, zone cooldowns, daily drawdown limits, and position sizing before any signal is logged or broadcast.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Risk Rules Form */}
        <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 p-5 lg:col-span-4 space-y-4">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            Signal Gate Rules
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="risk-balance"
                className="block text-xs text-slate-400 mb-1"
              >
                Account Balance ($)
              </label>
              <input
                id="risk-balance"
                type="number"
                min={100}
                step={100}
                value={settings.accountBalance}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    accountBalance: Math.max(100, Number(e.target.value) || 0),
                  })
                }
                className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="risk-pct"
                className="block text-xs text-slate-400 mb-1"
              >
                Risk per Trade (%)
              </label>
              <input
                id="risk-pct"
                type="number"
                min={0.1}
                max={5}
                step={0.1}
                value={settings.riskPercent}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    riskPercent: Math.max(0.1, Number(e.target.value) || 0.5),
                  })
                }
                className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="min-rr"
                className="block text-xs text-slate-400 mb-1"
              >
                Minimum R:R Ratio
              </label>
              <input
                id="min-rr"
                type="number"
                min={1}
                max={10}
                step={0.25}
                value={settings.minRR}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    minRR: Math.max(1, Number(e.target.value) || 2),
                  })
                }
                className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="cooldown-candles"
                className="block text-xs text-slate-400 mb-1"
              >
                Zone Cooldown (bars)
              </label>
              <input
                id="cooldown-candles"
                type="number"
                min={1}
                max={100}
                value={settings.cooldownCandles}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    cooldownCandles: Math.max(1, Number(e.target.value) || 12),
                  })
                }
                className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="daily-loss-limit"
                className="block text-xs text-slate-400 mb-1"
              >
                Daily Loss Limit (%)
              </label>
              <input
                id="daily-loss-limit"
                type="number"
                min={0.5}
                max={10}
                step={0.5}
                value={settings.dailyLossLimitPercent}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    dailyLossLimitPercent: Math.max(0.5, Number(e.target.value) || 3),
                  })
                }
                className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="max-open"
                className="block text-xs text-slate-400 mb-1"
              >
                Max Open Signals
              </label>
              <input
                id="max-open"
                type="number"
                min={1}
                max={10}
                value={settings.maxOpenSignals}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    maxOpenSignals: Math.max(1, Number(e.target.value) || 3),
                  })
                }
                className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Active Signals</span>
              <span className="font-mono text-slate-200">
                {activeSignalsCount} / {settings.maxOpenSignals}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Max Daily Drawdown Cap</span>
              <span className="font-mono text-slate-200">${maxDailyLoss}</span>
            </div>
          </div>
        </div>

        {/* Position Sizing Calculator */}
        <div className="rounded-md border border-slate-800 bg-[#0F172A]/70 p-5 lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Position Size Calculator
            </h2>
            <button
              type="button"
              onClick={() => {
                setCalcSymbol(symbol);
                setEntryPrice(String(defaultEntry));
                setStopLoss(String(defaultStopLoss));
                setTakeProfit(String(defaultTakeProfit));
              }}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 whitespace-nowrap"
            >
              Sync Active Setup
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="calc-symbol"
                className="block text-xs text-slate-400 mb-1"
              >
                Instrument
              </label>
              <select
                id="calc-symbol"
                value={calcSymbol}
                onChange={(e) => setCalcSymbol(e.target.value as MarketSymbol)}
                className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
              >
                <option value="XAUUSD">XAUUSD</option>
                <option value="EURUSD">EURUSD</option>
                <option value="GBPUSD">GBPUSD</option>
                <option value="USDJPY">USDJPY</option>
                <option value="BTCUSDT">BTCUSDT</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="calc-entry"
                className="block text-xs text-slate-400 mb-1"
              >
                Entry Price
              </label>
              <input
                id="calc-entry"
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="calc-sl"
                className="block text-xs text-slate-400 mb-1"
              >
                Stop Loss
              </label>
              <input
                id="calc-sl"
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="calc-tp"
                className="block text-xs text-slate-400 mb-1"
              >
                Take Profit
              </label>
              <input
                id="calc-tp"
                type="number"
                step="any"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 font-mono text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            </div>
          </div>

          {sizing ? (
            <div className="border-t border-slate-800 pt-4 grid grid-cols-2 gap-y-3 text-xs">
              <div>
                <p className="text-slate-400">Dollar Risk</p>
                <p className="font-mono text-base font-semibold text-slate-100">
                  ${sizing.riskAmount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Recommended Size</p>
                <p
                  data-testid="recommended-lots"
                  className="font-mono text-base font-semibold text-sky-400"
                >
                  {sizing.recommendedLots.toFixed(2)} lots
                </p>
              </div>
              <div>
                <p className="text-slate-400">Stop Distance</p>
                <p className="font-mono text-slate-200">
                  {sizing.stopPips} pips ({sizing.stopDistance})
                </p>
              </div>
              <div>
                <p className="text-slate-400">R:R Gate</p>
                <p
                  className={`font-mono font-semibold ${
                    sizing.passesMinRR ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {sizing.rrRatio.toFixed(2)}:1{' '}
                  {sizing.passesMinRR ? '· Pass' : '· Below Min'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-rose-400">Enter valid numeric prices.</p>
          )}
        </div>

        {/* Alert Dispatcher */}
        <form
          onSubmit={handleSendTestAlert}
          className="rounded-md border border-slate-800 bg-[#0F172A]/70 p-5 lg:col-span-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Alert Notifier (Telegram / Webhook)
            </h2>
          </div>

          <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-[#0B1120] p-1">
            <button
              type="button"
              onClick={() => setAlertChannel('webhook')}
              className={`flex-1 rounded py-1.5 text-xs font-medium transition-colors ${
                alertChannel === 'webhook'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              HTTPS Webhook
            </button>
            <button
              type="button"
              onClick={() => setAlertChannel('telegram')}
              className={`flex-1 rounded py-1.5 text-xs font-medium transition-colors ${
                alertChannel === 'telegram'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Telegram Bot
            </button>
          </div>

          {alertChannel === 'webhook' ? (
            <div>
              <label
                htmlFor="webhook-url"
                className="block text-xs text-slate-400 mb-1"
              >
                Webhook Endpoint (HTTPS)
              </label>
              <input
                id="webhook-url"
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="tg-token"
                  className="block text-xs text-slate-400 mb-1"
                >
                  Telegram Bot Token
                </label>
                <input
                  id="tg-token"
                  type="password"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="123456:ABC-DEF..."
                  className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="tg-chat"
                  className="block text-xs text-slate-400 mb-1"
                >
                  Target Chat ID
                </label>
                <input
                  id="tg-chat"
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="-1001234567890"
                  className="w-full rounded-md border border-slate-700 bg-[#0B1120] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {alertStatus && (
            <p
              className={`text-xs ${
                alertStatus.type === 'success'
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {alertStatus.message}
            </p>
          )}

          <button
            type="submit"
            disabled={sendingAlert}
            className="w-full rounded-md bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-white disabled:opacity-60 transition-colors"
          >
            {sendingAlert ? 'Sending Alert...' : 'Send Test Signal Alert'}
          </button>

          <p className="text-[11px] leading-relaxed text-slate-500">
            Signals are analytical decision aids, not guaranteed trades. Validate liquidity and spread before live execution, and paper-trade rule adjustments first.
          </p>
        </form>
      </div>
    </div>
  );
};
