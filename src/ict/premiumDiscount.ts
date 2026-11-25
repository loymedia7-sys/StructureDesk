import type { Candle, DealingRange, SwingPoint } from './types';

/**
 * Computes the current Dealing Range (Premium / Discount & OTE 62%–79% zone)
 * from the most recent major swing high and swing low.
 */
export function computeDealingRange(
  candles: Candle[],
  swings: SwingPoint[]
): DealingRange | null {
  if (candles.length === 0 || swings.length === 0) return null;

  const highs = swings.filter((s) => s.type === 'high');
  const lows = swings.filter((s) => s.type === 'low');

  const latestHigh = highs[highs.length - 1];
  const latestLow = lows[lows.length - 1];

  if (!latestHigh || !latestLow || latestHigh.price <= latestLow.price) {
    // Fallback to visible window high/low
    let maxH = -Infinity;
    let maxIdx = 0;
    let minL = Infinity;
    let minIdx = 0;
    const start = Math.max(0, candles.length - 40);
    for (let i = start; i < candles.length; i++) {
      if (candles[i].high > maxH) {
        maxH = candles[i].high;
        maxIdx = i;
      }
      if (candles[i].low < minL) {
        minL = candles[i].low;
        minIdx = i;
      }
    }
    if (maxH <= minL) return null;
    return buildRange(maxH, maxIdx, minL, minIdx, candles[candles.length - 1].close);
  }

  return buildRange(
    latestHigh.price,
    latestHigh.index,
    latestLow.price,
    latestLow.index,
    candles[candles.length - 1].close
  );
}

function buildRange(
  swingHigh: number,
  swingHighIndex: number,
  swingLow: number,
  swingLowIndex: number,
  currentPrice: number
): DealingRange {
  const span = swingHigh - swingLow;
  const equilibrium = swingLow + span * 0.5;

  // Bullish OTE: 62% to 79% pullback from swingHigh down toward swingLow
  const oteBullishTop = swingHigh - span * 0.62;
  const oteBullishBottom = swingHigh - span * 0.79;

  // Bearish OTE: 62% to 79% pullback from swingLow up toward swingHigh
  const oteBearishBottom = swingLow + span * 0.62;
  const oteBearishTop = swingLow + span * 0.79;

  const zone = currentPrice <= equilibrium ? 'discount' : 'premium';
  const retracementPct = ((swingHigh - currentPrice) / span) * 100;

  return {
    swingHigh,
    swingHighIndex,
    swingLow,
    swingLowIndex,
    equilibrium,
    oteBullishTop,
    oteBullishBottom,
    oteBearishBottom,
    oteBearishTop,
    currentPrice,
    zone,
    retracementPct: Math.max(0, Math.min(100, retracementPct)),
  };
}
