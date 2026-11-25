import type { Candle, LiquidityLevel, LiquiditySweep, SwingPoint } from './types';

/**
 * Finds equal highs (buy-side liquidity) and equal lows (sell-side liquidity)
 * within a relative price tolerance, plus prominent unswept swing highs/lows.
 */
export function findLiquidityLevels(
  candles: Candle[],
  swings: SwingPoint[],
  tolerancePct = 0.0008
): LiquidityLevel[] {
  const levels: LiquidityLevel[] = [];
  const highs = swings.filter((s) => s.type === 'high');
  const lows = swings.filter((s) => s.type === 'low');

  const clusterSwings = (
    points: SwingPoint[],
    side: 'buy_side' | 'sell_side'
  ) => {
    const used = new Set<number>();
    for (let i = 0; i < points.length; i++) {
      if (used.has(i)) continue;
      const anchor = points[i];
      const cluster: SwingPoint[] = [anchor];
      used.add(i);

      for (let j = i + 1; j < points.length; j++) {
        if (used.has(j)) continue;
        const diffPct = Math.abs(points[j].price - anchor.price) / anchor.price;
        if (diffPct <= tolerancePct) {
          cluster.push(points[j]);
          used.add(j);
        }
      }

      const avgPrice =
        cluster.reduce((sum, item) => sum + item.price, 0) / cluster.length;
      const lastIndex = cluster[cluster.length - 1].index;

      let swept = false;
      for (let k = lastIndex + 1; k < candles.length; k++) {
        if (side === 'buy_side' && candles[k].high > avgPrice) {
          swept = true;
          break;
        }
        if (side === 'sell_side' && candles[k].low < avgPrice) {
          swept = true;
          break;
        }
      }

      levels.push({
        id: `liq-${side}-${anchor.index}`,
        side,
        price: avgPrice,
        count: cluster.length,
        indices: cluster.map((p) => p.index),
        times: cluster.map((p) => p.time),
        swept,
      });
    }
  };

  clusterSwings(highs, 'buy_side');
  clusterSwings(lows, 'sell_side');

  return levels.sort((a, b) => a.indices[0] - b.indices[0]);
}

/**
 * Detects liquidity sweeps:
 * - Sell-side sweep: candle wicks below a prior swing/equal low, then closes back above it.
 * - Buy-side sweep: candle wicks above a prior swing/equal high, then closes back below it.
 */
export function detectLiquiditySweeps(
  candles: Candle[],
  swings: SwingPoint[],
  rightConfirm = 3
): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];
  const sweptSwings = new Set<number>();

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    // Only consider swings confirmed before candle i
    const availableSwings = swings.filter(
      (s) => s.index + rightConfirm < i && !sweptSwings.has(s.index)
    );

    for (const s of availableSwings) {
      if (s.type === 'low' && c.low < s.price && c.close > s.price) {
        sweptSwings.add(s.index);
        sweeps.push({
          id: `sweep-ssl-${i}-${s.index}`,
          side: 'sell_side',
          levelPrice: s.price,
          sweepExtreme: c.low,
          candleIndex: i,
          time: c.time,
        });
      } else if (s.type === 'high' && c.high > s.price && c.close < s.price) {
        sweptSwings.add(s.index);
        sweeps.push({
          id: `sweep-bsl-${i}-${s.index}`,
          side: 'buy_side',
          levelPrice: s.price,
          sweepExtreme: c.high,
          candleIndex: i,
          time: c.time,
        });
      }
    }
  }

  return sweeps;
}
