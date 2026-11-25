import { evaluateMultiTimeframeSetup } from './engine';
import type { BacktestConfig, BacktestReport, BacktestTrade, Candle } from './types';

/**
 * Replays historical candles strictly bar-by-bar with zero look-ahead bias.
 * Every setup decision at bar `i` only sees candles[0..i].
 */
export function runBacktest(params: {
  ltfCandles: Candle[];
  mtfCandles: Candle[];
  htfCandles: Candle[];
  config: BacktestConfig;
}): BacktestReport {
  const { ltfCandles, mtfCandles, htfCandles, config } = params;
  const trades: BacktestTrade[] = [];
  let balance = config.startingBalance;
  let peakBalance = balance;
  let maxDrawdownPct = 0;
  let lastTradeBar = -Infinity;

  const equityCurve: { time: number; balance: number }[] = [];
  const warmup = Math.min(45, Math.floor(ltfCandles.length * 0.25));

  if (ltfCandles.length > warmup) {
    equityCurve.push({ time: ltfCandles[warmup].time, balance });
  }

  let i = warmup;
  while (i < ltfCandles.length - 5) {
    if (i - lastTradeBar < config.cooldownCandles) {
      i++;
      continue;
    }

    const currentSlice = ltfCandles.slice(0, i + 1);
    const currentTime = ltfCandles[i].time;

    // Strictly slice HTF and MTF candles up to currentTime (zero look-ahead)
    const visibleHtf = htfCandles.filter((c) => c.time <= currentTime);
    const visibleMtf = mtfCandles.filter((c) => c.time <= currentTime);

    const { setup } = evaluateMultiTimeframeSetup({
      symbol: config.symbol,
      entryTimeframe: config.timeframe,
      htfCandles: visibleHtf.length >= 20 ? visibleHtf : currentSlice,
      mtfCandles: visibleMtf.length >= 20 ? visibleMtf : currentSlice,
      ltfCandles: currentSlice,
      requireHTFAlignment: config.requireHTFAlignment,
    });

    if (!setup) {
      i++;
      continue;
    }

    const passesKillzone = !config.requireKillzone || setup.setup.in_killzone;
    const hasConfluence =
      (setup.setup.choch || setup.setup.bos) &&
      (setup.setup.fvg !== null || setup.setup.order_block !== null);

    if (!passesKillzone || !hasConfluence || setup.setup.rr_estimate < config.minRR) {
      i++;
      continue;
    }

    // Simulate trade execution on subsequent closed bars starting at i + 1
    const entryPrice = ltfCandles[i].close;
    const stopLoss = setup.stop_loss;
    const takeProfit = setup.take_profit;
    const riskDist = Math.abs(entryPrice - stopLoss);
    if (riskDist <= 0) {
      i++;
      continue;
    }

    const actualRR = Math.abs(takeProfit - entryPrice) / riskDist;
    if (actualRR < config.minRR) {
      i++;
      continue;
    }

    let exitIndex = -1;
    let outcome: 'win' | 'loss' | null = null;
    let exitPrice = entryPrice;

    for (let j = i + 1; j < ltfCandles.length; j++) {
      const bar = ltfCandles[j];
      if (setup.direction === 'long') {
        // Conservative assumption: check stop loss first if both hit inside same bar
        if (bar.low <= stopLoss) {
          outcome = 'loss';
          exitIndex = j;
          exitPrice = stopLoss;
          break;
        }
        if (bar.high >= takeProfit) {
          outcome = 'win';
          exitIndex = j;
          exitPrice = takeProfit;
          break;
        }
      } else {
        if (bar.high >= stopLoss) {
          outcome = 'loss';
          exitIndex = j;
          exitPrice = stopLoss;
          break;
        }
        if (bar.low <= takeProfit) {
          outcome = 'win';
          exitIndex = j;
          exitPrice = takeProfit;
          break;
        }
      }
    }

    if (!outcome || exitIndex === -1) {
      break;
    }

    const riskDollar = balance * (config.riskPercent / 100);
    const rMultiple = outcome === 'win' ? Number(actualRR.toFixed(2)) : -1;
    const pnlDollar = riskDollar * rMultiple;
    balance = Number((balance + pnlDollar).toFixed(2));

    if (balance > peakBalance) peakBalance = balance;
    const ddPct = peakBalance > 0 ? ((peakBalance - balance) / peakBalance) * 100 : 0;
    if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;

    const confluences: string[] = [];
    if (setup.setup.sweep) confluences.push('Sweep');
    if (setup.setup.choch) confluences.push('CHoCH');
    if (setup.setup.bos) confluences.push('BOS');
    if (setup.setup.fvg) confluences.push('FVG');
    if (setup.setup.order_block) confluences.push('OB');
    if (setup.setup.in_killzone) confluences.push('Killzone');

    trades.push({
      id: `bt-${trades.length + 1}`,
      entryIndex: i,
      exitIndex,
      entryTime: ltfCandles[i].time,
      exitTime: ltfCandles[exitIndex].time,
      direction: setup.direction,
      entryPrice,
      stopLoss,
      takeProfit,
      exitPrice,
      outcome,
      rMultiple,
      pnlDollar: Number(pnlDollar.toFixed(2)),
      balanceAfter: balance,
      sessionLabel: setup.session_label,
      confluences,
    });

    equityCurve.push({ time: ltfCandles[exitIndex].time, balance });
    lastTradeBar = exitIndex;
    i = exitIndex + 1;
  }

  const wins = trades.filter((t) => t.outcome === 'win').length;
  const losses = trades.length - wins;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const winningTrades = trades.filter((t) => t.outcome === 'win');
  const avgRR =
    winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.rMultiple, 0) / winningTrades.length
      : 0;
  const expectancyR =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + t.rMultiple, 0) / trades.length
      : 0;

  const grossProfit = trades
    .filter((t) => t.pnlDollar > 0)
    .reduce((sum, t) => sum + t.pnlDollar, 0);
  const grossLoss = Math.abs(
    trades.filter((t) => t.pnlDollar < 0).reduce((sum, t) => sum + t.pnlDollar, 0)
  );
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;
  const netReturnPct =
    ((balance - config.startingBalance) / config.startingBalance) * 100;

  return {
    config,
    totalTrades: trades.length,
    wins,
    losses,
    winRate: Number(winRate.toFixed(1)),
    avgRR: Number(avgRR.toFixed(2)),
    expectancyR: Number(expectancyR.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    netReturnPct: Number(netReturnPct.toFixed(2)),
    finalBalance: balance,
    equityCurve,
    trades,
  };
}
