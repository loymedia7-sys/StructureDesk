import type { Candle, OrderBlock, StructureEvent } from './types';

/**
 * Identifies Order Blocks:
 * - Bullish OB: the last bearish (down-close) candle before a bullish displacement move causing a BOS/CHoCH.
 * - Bearish OB: the last bullish (up-close) candle before a bearish displacement move causing a BOS/CHoCH.
 */
export function findOrderBlocks(
  candles: Candle[],
  structureEvents: StructureEvent[],
  lookback = 12
): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  const seenCandleIndices = new Set<number>();

  for (const ev of structureEvents) {
    const startSearch = Math.max(0, ev.index - lookback);
    let obIndex = -1;

    if (ev.direction === 'bullish') {
      for (let i = ev.index - 1; i >= startSearch; i--) {
        if (candles[i].close < candles[i].open) {
          obIndex = i;
          break;
        }
      }
    } else {
      for (let i = ev.index - 1; i >= startSearch; i--) {
        if (candles[i].close > candles[i].open) {
          obIndex = i;
          break;
        }
      }
    }

    if (obIndex === -1 || seenCandleIndices.has(obIndex)) continue;
    seenCandleIndices.add(obIndex);

    const obCandle = candles[obIndex];
    const top = Math.max(obCandle.open, obCandle.close, obCandle.high);
    const bottom = Math.min(obCandle.open, obCandle.close, obCandle.low);

    let mitigated = false;
    let mitigatedIndex: number | null = null;
    for (let j = ev.index + 1; j < candles.length; j++) {
      if (ev.direction === 'bullish' && candles[j].low <= obCandle.low) {
        mitigated = true;
        mitigatedIndex = j;
        break;
      }
      if (ev.direction === 'bearish' && candles[j].high >= obCandle.high) {
        mitigated = true;
        mitigatedIndex = j;
        break;
      }
    }

    blocks.push({
      id: `ob-${ev.direction}-${obIndex}`,
      type: ev.direction,
      top,
      bottom,
      candleIndex: obIndex,
      time: obCandle.time,
      causeEvent: ev.type,
      mitigated,
      mitigatedIndex,
    });
  }

  return blocks;
}
