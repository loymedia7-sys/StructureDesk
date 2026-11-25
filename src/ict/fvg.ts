import type { Candle, FairValueGap } from './types';

/**
 * Finds 3-candle Fair Value Gaps (imbalances) and checks whether subsequent candles mitigate them.
 * - Bullish FVG: candle[i].low > candle[i - 2].high
 * - Bearish FVG: candle[i].high < candle[i - 2].low
 */
export function findFairValueGaps(candles: Candle[]): FairValueGap[] {
  const gaps: FairValueGap[] = [];
  if (candles.length < 3) return gaps;

  for (let i = 2; i < candles.length; i++) {
    const a = candles[i - 2];
    const b = candles[i - 1];
    const c = candles[i];

    if (c.low > a.high) {
      const top = c.low;
      const bottom = a.high;
      let mitigated = false;
      let mitigatedIndex: number | null = null;

      for (let j = i + 1; j < candles.length; j++) {
        // Considered mitigated once price trades into at least 50% (CE) or fully fills the gap
        if (candles[j].low <= bottom) {
          mitigated = true;
          mitigatedIndex = j;
          break;
        }
      }

      gaps.push({
        id: `fvg-bull-${i - 1}`,
        type: 'bullish',
        top,
        bottom,
        midpoint: (top + bottom) / 2,
        startIndex: i - 1,
        startTime: b.time,
        endTime: candles[mitigatedIndex ?? candles.length - 1].time,
        mitigated,
        mitigatedIndex,
      });
    } else if (c.high < a.low) {
      const top = a.low;
      const bottom = c.high;
      let mitigated = false;
      let mitigatedIndex: number | null = null;

      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].high >= top) {
          mitigated = true;
          mitigatedIndex = j;
          break;
        }
      }

      gaps.push({
        id: `fvg-bear-${i - 1}`,
        type: 'bearish',
        top,
        bottom,
        midpoint: (top + bottom) / 2,
        startIndex: i - 1,
        startTime: b.time,
        endTime: candles[mitigatedIndex ?? candles.length - 1].time,
        mitigated,
        mitigatedIndex,
      });
    }
  }

  return gaps;
}
