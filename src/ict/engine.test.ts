import test from 'node:test';
import assert from 'node:assert/strict';
import { findSwingPoints, detectMarketStructure } from './structure';
import { findFairValueGaps } from './fvg';
import { findOrderBlocks } from './orderBlocks';
import { detectLiquiditySweeps, findLiquidityLevels } from './liquidity';
import { computeDealingRange } from './premiumDiscount';
import { classifyKillzone } from './killzones';
import { calculatePositionSize, checkSignalEligibility } from './risk';
import { buildAnalystInputPayload, evaluateMultiTimeframeSetup } from './engine';
import {
  generateBacktestDataset,
  generateInstitutionalDataset,
  parseCandlesInput,
} from './candles';
import { runBacktest } from './backtest';
import type { Candle, RiskSettings } from './types';

function makeCandle(time: number, open: number, high: number, low: number, close: number): Candle {
  return { time, open, high, low, close, volume: 1000 };
}

test('findSwingPoints detects clear swing high and swing low', () => {
  const base = 1700000000;
  const candles: Candle[] = [
    makeCandle(base + 0, 100, 102, 99, 101),
    makeCandle(base + 300, 101, 104, 100, 103),
    makeCandle(base + 600, 103, 106, 102, 105),
    makeCandle(base + 900, 105, 112, 104, 106), // swing high at index 3 (112)
    makeCandle(base + 1200, 106, 108, 101, 102),
    makeCandle(base + 1500, 102, 104, 98, 99),
    makeCandle(base + 1800, 99, 101, 95, 96),
    makeCandle(base + 2100, 96, 98, 90, 95), // swing low at index 7 (90)
    makeCandle(base + 2400, 95, 99, 93, 98),
    makeCandle(base + 2700, 98, 102, 96, 101),
    makeCandle(base + 3000, 101, 105, 99, 104),
  ];

  const swings = findSwingPoints(candles, 2, 2);
  const highs = swings.filter((s) => s.type === 'high');
  const lows = swings.filter((s) => s.type === 'low');

  assert.equal(highs.some((h) => h.index === 3 && h.price === 112), true);
  assert.equal(lows.some((l) => l.index === 7 && l.price === 90), true);
});

test('findFairValueGaps identifies bullish and bearish 3-candle imbalances', () => {
  const base = 1700000000;
  const candles: Candle[] = [
    makeCandle(base + 0, 100, 102, 99, 101),
    makeCandle(base + 300, 101, 107, 101, 106),
    makeCandle(base + 600, 106, 109, 104, 108), // bullish FVG: c[2].low (104) > c[0].high (102)
    makeCandle(base + 900, 108, 109, 105, 106),
    makeCandle(base + 1200, 106, 107, 100, 101),
    makeCandle(base + 1500, 101, 103, 98, 99), // bearish FVG: c[5].high (103) < c[3].low (105)
  ];

  const fvgs = findFairValueGaps(candles);
  assert.equal(fvgs.length, 2);
  assert.equal(fvgs[0].type, 'bullish');
  assert.equal(fvgs[0].bottom, 102);
  assert.equal(fvgs[0].top, 104);
  assert.equal(fvgs[1].type, 'bearish');
  assert.equal(fvgs[1].bottom, 103);
  assert.equal(fvgs[1].top, 105);
});

test('detectMarketStructure detects BOS and CHoCH transitions', () => {
  const dataset = generateInstitutionalDataset({
    symbol: 'XAUUSD',
    timeframe: '5m',
    count: 140,
    scenario: 'london_bullish_sweep',
  });
  const swings = findSwingPoints(dataset.ltfCandles, 3, 3);
  const { events, trend } = detectMarketStructure(dataset.ltfCandles, swings, 3);

  assert.ok(events.length > 0, 'Expected market structure events');
  assert.ok(
    events.some((e) => e.type === 'BOS' || e.type === 'CHoCH'),
    'Expected BOS or CHoCH events'
  );
  assert.ok(['bullish', 'bearish'].includes(trend));

  const obs = findOrderBlocks(dataset.ltfCandles, events);
  assert.ok(obs.length > 0, 'Expected order blocks tied to structure breaks');
});

test('detectLiquiditySweeps catches wick beyond swing low and close back inside', () => {
  const base = 1700000000;
  const candles: Candle[] = [
    makeCandle(base + 0, 105, 107, 104, 106),
    makeCandle(base + 300, 106, 106, 102, 103),
    makeCandle(base + 600, 103, 104, 100, 102), // swing low at index 2 (100)
    makeCandle(base + 900, 102, 105, 101, 104),
    makeCandle(base + 1200, 104, 106, 102, 105),
    makeCandle(base + 1500, 105, 106, 103, 104),
    makeCandle(base + 1800, 104, 104, 98.5, 101.5), // sweeps below 100 (98.5) and closes inside (101.5)
  ];

  const swings = findSwingPoints(candles, 2, 2);
  const levels = findLiquidityLevels(candles, swings, 0.002);
  const sweeps = detectLiquiditySweeps(candles, swings, 2);

  assert.ok(levels.length > 0);
  assert.equal(sweeps.length, 1);
  assert.equal(sweeps[0].side, 'sell_side');
  assert.equal(sweeps[0].sweepExtreme, 98.5);
});

test('computeDealingRange and classifyKillzone return accurate zones and UTC sessions', () => {
  const swings = [
    { index: 2, time: 1700000000, price: 2300, type: 'low' as const },
    { index: 10, time: 1700003000, price: 2400, type: 'high' as const },
  ];
  const candles = [makeCandle(1700003300, 2330, 2335, 2325, 2330)];
  const range = computeDealingRange(candles, swings);

  assert.ok(range);
  assert.equal(range.equilibrium, 2350);
  assert.equal(range.zone, 'discount');
  assert.equal(Number(range.oteBullishTop.toFixed(1)), 2338);
  assert.equal(Number(range.oteBullishBottom.toFixed(1)), 2321);

  const londonTs = Math.floor(Date.UTC(2026, 10, 25, 8, 15, 0) / 1000);
  const nyTs = Math.floor(Date.UTC(2026, 10, 25, 13, 30, 0) / 1000);
  const offTs = Math.floor(Date.UTC(2026, 10, 25, 20, 0, 0) / 1000);

  assert.equal(classifyKillzone(londonTs).id, 'london_killzone');
  assert.equal(classifyKillzone(nyTs).id, 'new_york_killzone');
  assert.equal(classifyKillzone(offTs).inKillzone, false);
});

test('evaluateMultiTimeframeSetup and risk position sizing produce valid setup', () => {
  const dataset = generateInstitutionalDataset({
    symbol: 'XAUUSD',
    timeframe: '5m',
    count: 160,
    scenario: 'london_bullish_sweep',
  });

  const result = evaluateMultiTimeframeSetup({
    symbol: 'XAUUSD',
    entryTimeframe: '5m',
    htfCandles: dataset.htfCandles,
    mtfCandles: dataset.mtfCandles,
    ltfCandles: dataset.ltfCandles,
    requireHTFAlignment: true,
  });

  assert.ok(result.setup, 'Expected a multi-timeframe ICT setup');
  assert.equal(result.setup.symbol, 'XAUUSD');

  const sizing = calculatePositionSize({
    symbol: 'XAUUSD',
    accountBalance: 10000,
    riskPercent: 1,
    entryPrice: 2635.0,
    stopLoss: 2630.0,
    takeProfit: 2650.0,
    minRR: 2.0,
  });

  assert.equal(sizing.riskAmount, 100);
  assert.equal(sizing.rrRatio, 3);
  assert.equal(sizing.passesMinRR, true);

  const settings: RiskSettings = {
    accountBalance: 10000,
    riskPercent: 1,
    minRR: 2.0,
    cooldownCandles: 12,
    dailyLossLimitPercent: 3,
    maxOpenSignals: 3,
  };
  const eligibility = checkSignalEligibility({
    setup: {
      ...result.setup,
      setup: { ...result.setup.setup, rr_estimate: 1.5 },
    },
    existingSignals: [],
    settings,
  });
  assert.equal(eligibility.allowed, false);
});

test('runBacktest executes without look-ahead on multi-cycle history and parses CSV', () => {
  const dataset = generateBacktestDataset({
    symbol: 'EURUSD',
    timeframe: '5m',
    count: 320,
  });

  const report = runBacktest({
    ltfCandles: dataset.ltfCandles,
    mtfCandles: dataset.mtfCandles,
    htfCandles: dataset.htfCandles,
    config: {
      symbol: 'EURUSD',
      timeframe: '5m',
      minRR: 2.0,
      requireKillzone: false,
      requireHTFAlignment: false,
      riskPercent: 1,
      startingBalance: 10000,
      cooldownCandles: 8,
    },
  });

  assert.ok(report.totalTrades >= 2, `Expected >= 2 trades, got ${report.totalTrades}`);
  assert.ok(report.equityCurve.length >= 2);
  assert.equal(report.wins + report.losses, report.totalTrades);

  const csvRows = [
    'time,open,high,low,close,volume',
    ...dataset.ltfCandles
      .slice(0, 15)
      .map((c) => `${c.time},${c.open},${c.high},${c.low},${c.close},${c.volume}`),
  ].join('\n');
  const parsed = parseCandlesInput(csvRows);
  assert.equal(parsed.length, 15);
});

test('buildAnalystInputPayload formats canonical ICT/SMC/CSNR JSON input', () => {
  const dataset = generateInstitutionalDataset({
    symbol: 'XAUUSD',
    timeframe: '5m',
    count: 160,
    scenario: 'london_bullish_sweep',
  });
  const result = evaluateMultiTimeframeSetup({
    symbol: 'XAUUSD',
    entryTimeframe: '5m',
    htfCandles: dataset.htfCandles,
    mtfCandles: dataset.mtfCandles,
    ltfCandles: dataset.ltfCandles,
    requireHTFAlignment: false,
  });
  assert.ok(result.setup);

  const payload = buildAnalystInputPayload(result.setup, {
    language: 'km',
    newsRisk: 'low',
    csnrRule: {
      definition: 'Wick rejection at key S/R level',
      evaluationRules: 'Wick >= 40% of candle range',
      gradeFit: 'confluence',
    },
  });

  assert.equal(payload.language, 'km');
  assert.equal(payload.symbol, 'XAUUSD');
  assert.equal(payload.news_risk, 'low');
  assert.equal(payload.csnr.defined, true);
  assert.equal(payload.csnr.definition, 'Wick rejection at key S/R level');
  assert.ok(Array.isArray(payload.proposed_targets));
  assert.equal(payload.proposed_targets[0], result.setup.take_profit);
});
