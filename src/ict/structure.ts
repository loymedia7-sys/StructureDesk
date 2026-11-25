import type { Candle, StructureEvent, SwingPoint, TrendBias } from './types';

/**
 * Detects confirmed swing highs and swing lows using a symmetric or asymmetric pivot window.
 * A candle at index `i` is only confirmed after `right` subsequent candles have closed.
 */
export function findSwingPoints(
  candles: Candle[],
  left = 3,
  right = 3
): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (candles.length < left + right + 1) return swings;

  for (let i = left; i < candles.length - right; i++) {
    const c = candles[i];
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (candles[j].high > c.high) {
        isSwingHigh = false;
      }
      if (candles[j].low < c.low) {
        isSwingLow = false;
      }
      // Tie-breaker: keep earliest bar when identical highs/lows appear adjacent
      if (j < i && candles[j].high === c.high) {
        isSwingHigh = false;
      }
      if (j < i && candles[j].low === c.low) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) {
      swings.push({ index: i, time: c.time, price: c.high, type: 'high' });
    }
    if (isSwingLow) {
      swings.push({ index: i, time: c.time, price: c.low, type: 'low' });
    }
  }

  return swings.sort((a, b) => a.index - b.index || (a.type === 'low' ? -1 : 1));
}

/**
 * Tracks market structure candle-by-candle using confirmed swings.
 * - BOS (Break of Structure): candle closes beyond the last swing in the trend direction.
 * - CHoCH (Change of Character): candle closes beyond the last swing against the trend.
 */
export function detectMarketStructure(
  candles: Candle[],
  swings: SwingPoint[],
  rightConfirm = 3
): { events: StructureEvent[]; trend: TrendBias } {
  const events: StructureEvent[] = [];
  let trend: TrendBias = 'neutral';

  let lastSwingHigh: SwingPoint | null = null;
  let lastSwingLow: SwingPoint | null = null;
  const brokenHighIndices = new Set<number>();
  const brokenLowIndices = new Set<number>();

  // Map confirmation index -> swings confirmed at that candle close
  const confirmedAt = new Map<number, SwingPoint[]>();
  for (const s of swings) {
    const confirmIdx = s.index + rightConfirm;
    const list = confirmedAt.get(confirmIdx) ?? [];
    list.push(s);
    confirmedAt.set(confirmIdx, list);
  }

  for (let i = 0; i < candles.length; i++) {
    const newlyConfirmed = confirmedAt.get(i);
    if (newlyConfirmed) {
      for (const s of newlyConfirmed) {
        if (s.type === 'high') {
          lastSwingHigh = s;
        } else {
          lastSwingLow = s;
        }
      }
    }

    const c = candles[i];

    // Check bullish break above last confirmed swing high
    if (
      lastSwingHigh &&
      !brokenHighIndices.has(lastSwingHigh.index) &&
      c.close > lastSwingHigh.price
    ) {
      brokenHighIndices.add(lastSwingHigh.index);
      const eventType: 'BOS' | 'CHoCH' =
        trend === 'bearish' ? 'CHoCH' : 'BOS';
      trend = 'bullish';
      events.push({
        index: i,
        time: c.time,
        type: eventType,
        direction: 'bullish',
        brokenPrice: lastSwingHigh.price,
        brokenSwingIndex: lastSwingHigh.index,
        closePrice: c.close,
      });
    }

    // Check bearish break below last confirmed swing low
    if (
      lastSwingLow &&
      !brokenLowIndices.has(lastSwingLow.index) &&
      c.close < lastSwingLow.price
    ) {
      brokenLowIndices.add(lastSwingLow.index);
      const eventType: 'BOS' | 'CHoCH' =
        trend === 'bullish' ? 'CHoCH' : 'BOS';
      trend = 'bearish';
      events.push({
        index: i,
        time: c.time,
        type: eventType,
        direction: 'bearish',
        brokenPrice: lastSwingLow.price,
        brokenSwingIndex: lastSwingLow.index,
        closePrice: c.close,
      });
    }
  }

  return { events, trend };
}
