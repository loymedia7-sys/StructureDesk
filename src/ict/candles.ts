import type { Candle, MarketSymbol, Timeframe } from './types';

export type ReplayScenarioId =
  | 'london_bullish_sweep'
  | 'ny_bearish_ote'
  | 'london_bos_continuation';

export const SYMBOL_BASE_CONFIG: Record<
  MarketSymbol,
  { basePrice: number; step: number; decimals: number; label: string }
> = {
  XAUUSD: { basePrice: 2635.0, step: 0.95, decimals: 2, label: 'Gold / US Dollar' },
  EURUSD: { basePrice: 1.054, step: 0.00055, decimals: 5, label: 'Euro / US Dollar' },
  GBPUSD: { basePrice: 1.268, step: 0.00072, decimals: 5, label: 'British Pound / USD' },
  USDJPY: { basePrice: 153.4, step: 0.075, decimals: 3, label: 'US Dollar / Japanese Yen' },
  BTCUSDT: { basePrice: 91400, step: 145, decimals: 2, label: 'Bitcoin / Tether' },
};

export function timeframeSeconds(tf: Timeframe): number {
  switch (tf) {
    case '1m':
      return 60;
    case '5m':
      return 300;
    case '15m':
      return 900;
    case '1H':
      return 3600;
    case '4H':
      return 14400;
    case '1D':
      return 86400;
  }
}

/**
 * Deterministic PRNG (Mulberry32) so candle series are reproducible across runs.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDirectionalTrendSeries(params: {
  basePrice: number;
  step: number;
  decimals: number;
  count: number;
  endTime: number;
  tfSec: number;
  bullish: boolean;
  seed: number;
}): Candle[] {
  const { basePrice, step, decimals, count, endTime, tfSec, bullish, seed } = params;
  const rand = mulberry32(seed);
  const round = (v: number) => Number(v.toFixed(decimals));
  const startTime = endTime - (count - 1) * tfSec;
  const dir = bullish ? 1 : -1;

  const candles: Candle[] = [];
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * tfSec;
    const cycle = Math.sin(i * 0.45) * step * 1.4;
    const trendDrift = dir * step * 0.38;
    const noise = (rand() - 0.5) * step * 0.7;
    const delta = cycle + trendDrift + noise;

    const open = price;
    const close = price + delta;
    const high = Math.max(open, close) + step * (0.3 + rand() * 0.5);
    const low = Math.min(open, close) - step * (0.3 + rand() * 0.5);

    candles.push({
      time,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.round(900 + rand() * 1400),
    });
    price = close;
  }

  return candles;
}

/**
 * Generates deterministic institutional price-action candles with realistic
 * swing highs/lows, equal liquidity pools, sweeps, CHoCH, displacement FVGs,
 * and Order Blocks aligned across LTF, MTF (1H), and HTF (4H).
 */
export function generateInstitutionalDataset(params: {
  symbol: MarketSymbol;
  timeframe: Timeframe;
  count?: number;
  scenario?: ReplayScenarioId;
}): {
  ltfCandles: Candle[];
  mtfCandles: Candle[];
  htfCandles: Candle[];
} {
  const {
    symbol,
    timeframe,
    count = 160,
    scenario = 'london_bullish_sweep',
  } = params;

  const cfg = SYMBOL_BASE_CONFIG[symbol];
  const tfSec = timeframeSeconds(timeframe);

  const anchorHour = scenario === 'ny_bearish_ote' ? 13 : 8;
  const endDate = new Date(Date.UTC(2026, 10, 25, anchorHour, 30, 0));
  const endTime = Math.floor(endDate.getTime() / 1000);
  const startTime = endTime - (count - 1) * tfSec;

  const symbolSeed = symbol
    .split('')
    .reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
  const scenarioSeed =
    scenario === 'london_bullish_sweep'
      ? 101
      : scenario === 'ny_bearish_ote'
      ? 202
      : 303;
  const rand = mulberry32(symbolSeed + scenarioSeed + tfSec);

  const candles: Candle[] = [];
  let price = cfg.basePrice;
  const s = cfg.step;

  const isBearishScenario = scenario === 'ny_bearish_ote';
  const round = (v: number) => Number(v.toFixed(cfg.decimals));

  for (let i = 0; i < count; i++) {
    const time = startTime + i * tfSec;
    const noise = (rand() - 0.5) * s * 0.85;

    let delta = 0;
    let wickUp = s * (0.38 + rand() * 0.55);
    let wickDown = s * (0.38 + rand() * 0.55);

    if (!isBearishScenario) {
      if (i < count - 50) {
        delta = Math.sin(i * 0.28) * s * 1.15 + s * 0.14 + noise;
      } else if (i >= count - 50 && i < count - 26) {
        delta = Math.sin((i - (count - 50)) * 0.55) * s * 0.85 + noise * 0.4;
      } else if (i >= count - 26 && i < count - 20) {
        delta = -s * 0.85 + noise * 0.3;
      } else if (i === count - 20) {
        const sweepOpen = price;
        const sweepLow = price - s * 3.4;
        const sweepClose = price + s * 0.9;
        const sweepHigh = sweepClose + s * 0.4;
        candles.push({
          time,
          open: round(sweepOpen),
          high: round(sweepHigh),
          low: round(sweepLow),
          close: round(sweepClose),
          volume: Math.round(1400 + rand() * 900),
        });
        price = sweepClose;
        continue;
      } else if (i === count - 19) {
        delta = -s * 0.55;
      } else if (i >= count - 18 && i <= count - 14) {
        delta = s * 1.95;
        wickDown = s * 0.12;
        wickUp = s * 0.2;
      } else if (i > count - 14 && i <= count - 5) {
        delta = -s * 0.72 + noise * 0.25;
      } else {
        delta = s * 0.65 + noise * 0.35;
      }
    } else {
      if (i < count - 50) {
        delta = Math.sin(i * 0.28) * s * 1.15 - s * 0.13 + noise;
      } else if (i >= count - 50 && i < count - 26) {
        delta = Math.sin((i - (count - 50)) * 0.55) * s * 0.85 + noise * 0.4;
      } else if (i >= count - 26 && i < count - 20) {
        delta = s * 0.85 + noise * 0.3;
      } else if (i === count - 20) {
        const sweepOpen = price;
        const sweepHigh = price + s * 3.5;
        const sweepClose = price - s * 0.9;
        const sweepLow = sweepClose - s * 0.4;
        candles.push({
          time,
          open: round(sweepOpen),
          high: round(sweepHigh),
          low: round(sweepLow),
          close: round(sweepClose),
          volume: Math.round(1450 + rand() * 900),
        });
        price = sweepClose;
        continue;
      } else if (i === count - 19) {
        delta = s * 0.55;
      } else if (i >= count - 18 && i <= count - 14) {
        delta = -s * 1.95;
        wickUp = s * 0.12;
        wickDown = s * 0.2;
      } else if (i > count - 14 && i <= count - 5) {
        delta = s * 0.72 + noise * 0.25;
      } else {
        delta = -s * 0.65 + noise * 0.35;
      }
    }

    const open = price;
    const close = price + delta;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;

    candles.push({
      time,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.round(600 + rand() * 1100),
    });

    price = close;
  }

  // Dedicated 80-bar MTF (1H) and 60-bar HTF (4H) aligned to the macro scenario bias
  const mtfCandles = buildDirectionalTrendSeries({
    basePrice: cfg.basePrice,
    step: cfg.step * 2.1,
    decimals: cfg.decimals,
    count: 80,
    endTime,
    tfSec: 3600,
    bullish: !isBearishScenario,
    seed: symbolSeed + scenarioSeed + 700,
  });

  const htfCandles = buildDirectionalTrendSeries({
    basePrice: cfg.basePrice,
    step: cfg.step * 4.0,
    decimals: cfg.decimals,
    count: 60,
    endTime,
    tfSec: 14400,
    bullish: !isBearishScenario,
    seed: symbolSeed + scenarioSeed + 1400,
  });

  return {
    ltfCandles: candles,
    mtfCandles,
    htfCandles,
  };
}

/**
 * Generates multi-session historical candles with recurring sweeps, CHoCH/BOS,
 * FVGs, and both winning & losing impulses for realistic backtest evaluation.
 */
export function generateBacktestDataset(params: {
  symbol: MarketSymbol;
  timeframe: Timeframe;
  count?: number;
}): {
  ltfCandles: Candle[];
  mtfCandles: Candle[];
  htfCandles: Candle[];
} {
  const { symbol, timeframe, count = 320 } = params;
  const cfg = SYMBOL_BASE_CONFIG[symbol];
  const tfSec = timeframeSeconds(timeframe);
  const endDate = new Date(Date.UTC(2026, 10, 25, 14, 0, 0));
  const endTime = Math.floor(endDate.getTime() / 1000);
  const startTime = endTime - (count - 1) * tfSec;

  const symbolSeed = symbol
    .split('')
    .reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 19);
  const rand = mulberry32(symbolSeed + tfSec);
  const round = (v: number) => Number(v.toFixed(cfg.decimals));

  const candles: Candle[] = [];
  let price = cfg.basePrice;
  const s = cfg.step;

  // Repeat 34-bar institutional accumulation -> sweep -> displacement -> retrace -> target/stop cycles
  const cycleLen = 34;
  for (let i = 0; i < count; i++) {
    const time = startTime + i * tfSec;
    const phase = i % cycleLen;
    const cycleIdx = Math.floor(i / cycleLen);
    const isBullCycle = cycleIdx % 3 !== 2; // mix of bullish and bearish cycles
    const isFakeoutCycle = cycleIdx % 4 === 3; // occasional SL stop-out for realistic win rate
    const dir = isBullCycle ? 1 : -1;
    const noise = (rand() - 0.5) * s * 0.6;

    let delta = 0;
    let wickUp = s * (0.35 + rand() * 0.45);
    let wickDown = s * (0.35 + rand() * 0.45);

    if (phase < 10) {
      // Consolidation / equal levels
      delta = Math.sin(phase * 0.8) * s * 0.7 + noise * 0.4;
    } else if (phase >= 10 && phase < 13) {
      // Pull toward liquidity
      delta = -dir * s * 0.75;
    } else if (phase === 13) {
      // Liquidity sweep wick
      const open = price;
      const close = price + dir * s * 0.8;
      const low = isBullCycle ? price - s * 3.1 : close - s * 0.35;
      const high = isBullCycle ? close + s * 0.35 : price + s * 3.1;
      candles.push({
        time,
        open: round(open),
        high: round(high),
        low: round(low),
        close: round(close),
        volume: Math.round(1500 + rand() * 800),
      });
      price = close;
      continue;
    } else if (phase === 14) {
      // Opposing OB candle
      delta = -dir * s * 0.5;
    } else if (phase >= 15 && phase <= 18) {
      // Displacement creating FVG + BOS/CHoCH
      delta = dir * s * 1.9;
      if (isBullCycle) wickDown = s * 0.1;
      else wickUp = s * 0.1;
    } else if (phase >= 19 && phase <= 23) {
      // Pullback into discount/FVG
      delta = -dir * s * 0.65 + noise * 0.2;
    } else {
      // Continuation toward opposing liquidity OR stop-out on fakeout cycles
      delta = isFakeoutCycle ? -dir * s * 1.35 : dir * s * 1.45;
    }

    const open = price;
    const close = price + delta;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;

    candles.push({
      time,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.round(700 + rand() * 1100),
    });
    price = close;
  }

  const mtfCandles = buildDirectionalTrendSeries({
    basePrice: cfg.basePrice,
    step: cfg.step * 2.0,
    decimals: cfg.decimals,
    count: Math.max(80, Math.floor(count / 3)),
    endTime,
    tfSec: 3600,
    bullish: true,
    seed: symbolSeed + 501,
  });

  const htfCandles = buildDirectionalTrendSeries({
    basePrice: cfg.basePrice,
    step: cfg.step * 3.8,
    decimals: cfg.decimals,
    count: Math.max(60, Math.floor(count / 5)),
    endTime,
    tfSec: 14400,
    bullish: true,
    seed: symbolSeed + 901,
  });

  return { ltfCandles: candles, mtfCandles, htfCandles };
}

/**
 * Parses CSV or JSON OHLCV candle text uploaded or pasted by a trader.
 * Expected CSV columns: time,open,high,low,close[,volume]
 */
export function parseCandlesInput(raw: string): Candle[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Candle input is empty.');
  }

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error('JSON candle payload must be an array of OHLC objects.');
    }
    return parsed
      .map((item) => ({
        time: Number(item.time),
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume: Number(item.volume ?? 0),
      }))
      .filter(
        (c) =>
          Number.isFinite(c.time) &&
          Number.isFinite(c.open) &&
          Number.isFinite(c.high) &&
          Number.isFinite(c.low) &&
          Number.isFinite(c.close)
      )
      .sort((a, b) => a.time - b.time);
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const candles: Candle[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (idx === 0 && /[a-zA-Z]/.test(line) && line.toLowerCase().includes('open')) {
      continue;
    }
    const parts = line.split(/[,\t;]+/).map((p) => p.trim());
    if (parts.length < 5) {
      throw new Error(
        `Invalid CSV row at line ${idx + 1}: expected at least 5 columns (time,open,high,low,close).`
      );
    }
    let timeNum = Number(parts[0]);
    if (!Number.isFinite(timeNum)) {
      const parsedDate = Date.parse(parts[0]);
      if (Number.isNaN(parsedDate)) {
        throw new Error(`Invalid timestamp at line ${idx + 1}: "${parts[0]}"`);
      }
      timeNum = Math.floor(parsedDate / 1000);
    } else if (timeNum > 1e12) {
      timeNum = Math.floor(timeNum / 1000);
    }

    const open = Number(parts[1]);
    const high = Number(parts[2]);
    const low = Number(parts[3]);
    const close = Number(parts[4]);
    const volume = parts[5] !== undefined ? Number(parts[5]) : 0;

    if (![open, high, low, close].every(Number.isFinite)) {
      throw new Error(`Non-numeric OHLC values at line ${idx + 1}.`);
    }

    candles.push({
      time: timeNum,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0,
    });
  }

  if (candles.length < 10) {
    throw new Error('Provide at least 10 closed candles to run structure analysis.');
  }

  return candles.sort((a, b) => a.time - b.time);
}
