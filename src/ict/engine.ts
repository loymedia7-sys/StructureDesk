import { findFairValueGaps } from './fvg';
import { classifyKillzone } from './killzones';
import { detectLiquiditySweeps, findLiquidityLevels } from './liquidity';
import { findOrderBlocks } from './orderBlocks';
import { computeDealingRange } from './premiumDiscount';
import { getSymbolContractSpec } from './risk';
import { detectMarketStructure, findSwingPoints } from './structure';
import type {
  CSNRRuleConfig,
  Candle,
  ICTEngineAnalysis,
  MarketSymbol,
  NewsRiskLevel,
  StructuredAnalystInput,
  StructuredSetupPayload,
  Timeframe,
  TrendBias,
} from './types';

/**
 * Runs all pure ICT/SMC detectors on closed candles for a single timeframe.
 */
export function analyzeSingleTimeframe(
  symbol: MarketSymbol,
  timeframe: Timeframe,
  closedCandles: Candle[]
): ICTEngineAnalysis {
  const swings = findSwingPoints(closedCandles, 3, 3);
  const { events, trend } = detectMarketStructure(closedCandles, swings, 3);
  const fvgs = findFairValueGaps(closedCandles);
  const orderBlocks = findOrderBlocks(closedCandles, events, 12);
  const liquidityLevels = findLiquidityLevels(closedCandles, swings, 0.0008);
  const sweeps = detectLiquiditySweeps(closedCandles, swings, 3);
  const dealingRange = computeDealingRange(closedCandles, swings);

  const lastCandle = closedCandles[closedCandles.length - 1];
  const killzone = classifyKillzone(lastCandle ? lastCandle.time : Math.floor(Date.now() / 1000));

  return {
    symbol,
    timeframe,
    swings,
    structureEvents: events,
    trend,
    fvgs,
    orderBlocks,
    liquidityLevels,
    sweeps,
    dealingRange,
    killzone,
  };
}

/**
 * Evaluates a multi-timeframe ICT/SMC setup using HTF bias, MTF structure,
 * and LTF entry confirmation (sweep + CHoCH/BOS + FVG/OB + discount/premium + killzone).
 * Always uses closed candles only (no look-ahead / repainting).
 */
export function evaluateMultiTimeframeSetup(params: {
  symbol: MarketSymbol;
  entryTimeframe: Timeframe;
  htfCandles: Candle[];
  mtfCandles: Candle[];
  ltfCandles: Candle[];
  requireHTFAlignment?: boolean;
}): {
  ltfAnalysis: ICTEngineAnalysis;
  htfBias: TrendBias;
  mtfStructure: TrendBias;
  setup: StructuredSetupPayload | null;
} {
  const {
    symbol,
    entryTimeframe,
    htfCandles,
    mtfCandles,
    ltfCandles,
    requireHTFAlignment = true,
  } = params;

  const htfAnalysis = analyzeSingleTimeframe(symbol, '4H', htfCandles);
  const mtfAnalysis = analyzeSingleTimeframe(symbol, '1H', mtfCandles);
  const ltfAnalysis = analyzeSingleTimeframe(symbol, entryTimeframe, ltfCandles);

  const htfBias = htfAnalysis.trend;
  const mtfStructure = mtfAnalysis.trend;

  if (ltfCandles.length < 20) {
    return { ltfAnalysis, htfBias, mtfStructure, setup: null };
  }

  const lastCandle = ltfCandles[ltfCandles.length - 1];
  const spec = getSymbolContractSpec(symbol);
  const round = (v: number) => Number(v.toFixed(spec.decimals));

  // Determine candidate direction from HTF bias (when aligned) or latest LTF structure
  const recentEvents = ltfAnalysis.structureEvents.slice(-3);
  const latestEvent = recentEvents[recentEvents.length - 1];

  let direction: 'long' | 'short' | null = null;
  if (requireHTFAlignment) {
    if (htfBias === 'bullish') {
      direction = 'long';
    } else if (htfBias === 'bearish') {
      direction = 'short';
    } else if (latestEvent) {
      direction = latestEvent.direction === 'bullish' ? 'long' : 'short';
    }
  } else if (latestEvent) {
    direction = latestEvent.direction === 'bullish' ? 'long' : 'short';
  } else if (htfBias !== 'neutral') {
    direction = htfBias === 'bullish' ? 'long' : 'short';
  }

  if (!direction) {
    return { ltfAnalysis, htfBias, mtfStructure, setup: null };
  }

  // If HTF alignment is required, reject conflicting LTF structure
  const hasAlignedStructure =
    latestEvent &&
    ((direction === 'long' && latestEvent.direction === 'bullish') ||
      (direction === 'short' && latestEvent.direction === 'bearish'));

  if (requireHTFAlignment && htfBias !== 'neutral' && !hasAlignedStructure) {
    const matchingEvent = [...ltfAnalysis.structureEvents]
      .reverse()
      .find(
        (e) =>
          e.index >= ltfCandles.length - 25 &&
          ((direction === 'long' && e.direction === 'bullish') ||
            (direction === 'short' && e.direction === 'bearish'))
      );
    if (!matchingEvent) {
      return { ltfAnalysis, htfBias, mtfStructure, setup: null };
    }
  }

  const desiredType = direction === 'long' ? 'bullish' : 'bearish';
  const desiredSweepSide = direction === 'long' ? 'sell_side' : 'buy_side';

  // Find recent liquidity sweep in the last 25 candles
  const recentSweep = [...ltfAnalysis.sweeps]
    .reverse()
    .find(
      (s) =>
        s.side === desiredSweepSide && s.candleIndex >= ltfCandles.length - 28
    );

  // Find recent CHoCH or BOS
  const recentChoch = [...ltfAnalysis.structureEvents]
    .reverse()
    .find(
      (e) =>
        e.type === 'CHoCH' &&
        e.direction === desiredType &&
        e.index >= ltfCandles.length - 28
    );
  const recentBos = [...ltfAnalysis.structureEvents]
    .reverse()
    .find(
      (e) =>
        e.type === 'BOS' &&
        e.direction === desiredType &&
        e.index >= ltfCandles.length - 28
    );

  // Find active unmitigated FVG or Order Block formed recently near current price
  const maxZoneProximity = spec.pipSize * 60;
  const activeFvg = [...ltfAnalysis.fvgs]
    .reverse()
    .find(
      (g) =>
        g.type === desiredType &&
        !g.mitigated &&
        g.startIndex >= ltfCandles.length - 35 &&
        Math.abs(lastCandle.close - g.midpoint) <= maxZoneProximity
    );
  const activeOb = [...ltfAnalysis.orderBlocks]
    .reverse()
    .find(
      (b) =>
        b.type === desiredType &&
        !b.mitigated &&
        b.candleIndex >= ltfCandles.length - 35 &&
        Math.abs(lastCandle.close - (b.top + b.bottom) / 2) <= maxZoneProximity
    );

  const range = ltfAnalysis.dealingRange;
  const inDiscount = range ? range.zone === 'discount' : false;
  const inPremium = range ? range.zone === 'premium' : false;
  const inOte = range
    ? direction === 'long'
      ? lastCandle.close <= range.oteBullishTop &&
        lastCandle.close >= range.oteBullishBottom
      : lastCandle.close >= range.oteBearishBottom &&
        lastCandle.close <= range.oteBearishTop
    : false;

  // Determine entry, SL, and TP
  const entryPrice = activeFvg
    ? activeFvg.midpoint
    : activeOb && Math.abs(lastCandle.close - (activeOb.top + activeOb.bottom) / 2) <= spec.pipSize * 45
    ? (activeOb.top + activeOb.bottom) / 2
    : lastCandle.close;

  const recentLow = Math.min(...ltfCandles.slice(-6).map((c) => c.low));
  const recentHigh = Math.max(...ltfCandles.slice(-6).map((c) => c.high));
  const maxRealisticStop = spec.pipSize * 45;

  let stopLoss: number;
  if (direction === 'long') {
    const obValid = activeOb && entryPrice - activeOb.bottom > 0 && entryPrice - activeOb.bottom <= maxRealisticStop;
    const fvgValid = activeFvg && entryPrice - activeFvg.bottom > 0 && entryPrice - activeFvg.bottom <= maxRealisticStop;
    const slAnchor = obValid
      ? activeOb.bottom
      : fvgValid
      ? Math.min(activeFvg.bottom, recentLow)
      : recentLow;
    stopLoss = slAnchor - spec.pipSize * 2;
    if (stopLoss >= entryPrice || entryPrice - stopLoss > maxRealisticStop) {
      stopLoss = entryPrice - spec.pipSize * 18;
    }
  } else {
    const obValid = activeOb && activeOb.top - entryPrice > 0 && activeOb.top - entryPrice <= maxRealisticStop;
    const fvgValid = activeFvg && activeFvg.top - entryPrice > 0 && activeFvg.top - entryPrice <= maxRealisticStop;
    const slAnchor = obValid
      ? activeOb.top
      : fvgValid
      ? Math.max(activeFvg.top, recentHigh)
      : recentHigh;
    stopLoss = slAnchor + spec.pipSize * 2;
    if (stopLoss <= entryPrice || stopLoss - entryPrice > maxRealisticStop) {
      stopLoss = entryPrice + spec.pipSize * 18;
    }
  }

  const riskDist = Math.abs(entryPrice - stopLoss);

  // Opposing liquidity target
  const opposingLiq = ltfAnalysis.liquidityLevels
    .filter((l) =>
      direction === 'long'
        ? l.side === 'buy_side' && !l.swept && l.price > entryPrice + riskDist * 2
        : l.side === 'sell_side' && !l.swept && l.price < entryPrice - riskDist * 2
    )
    .sort((a, b) =>
      direction === 'long' ? a.price - b.price : b.price - a.price
    )[0];

  const defaultTarget =
    direction === 'long'
      ? entryPrice + riskDist * 3.1
      : entryPrice - riskDist * 3.1;

  const takeProfit = opposingLiq
    ? Math.abs(opposingLiq.price - entryPrice) / riskDist >= 2.2
      ? opposingLiq.price
      : defaultTarget
    : defaultTarget;

  const rrEstimate =
    riskDist > 0 ? Math.abs(takeProfit - entryPrice) / riskDist : 0;

  // Compute objective displacement, resting targets, and nearest S/R telemetry
  const avgRange =
    ltfCandles
      .slice(-20)
      .reduce((sum, c) => sum + Math.max(0.000001, c.high - c.low), 0) /
    Math.min(20, ltfCandles.length);
  const triggerCandle = recentChoch
    ? ltfCandles[recentChoch.index]
    : recentBos
    ? ltfCandles[recentBos.index]
    : lastCandle;
  const triggerBody = triggerCandle ? Math.abs(triggerCandle.close - triggerCandle.open) : 0;
  const displacementConfirmed = triggerBody >= avgRange * 0.75;

  const lastCandleRange = Math.max(0.000001, lastCandle.high - lastCandle.low);
  const rejectionWick =
    direction === 'long'
      ? Math.min(lastCandle.open, lastCandle.close) - lastCandle.low
      : lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
  const rejectionWickRatio = Number((rejectionWick / lastCandleRange).toFixed(2));

  const nearestSupport =
    [...ltfAnalysis.swings]
      .filter((s) => s.type === 'low' && s.price <= lastCandle.close)
      .sort((a, b) => b.price - a.price)[0]?.price ?? null;
  const nearestResistance =
    [...ltfAnalysis.swings]
      .filter((s) => s.type === 'high' && s.price >= lastCandle.close)
      .sort((a, b) => a.price - b.price)[0]?.price ?? null;

  const restingTargets = ltfAnalysis.liquidityLevels
    .filter((l) =>
      direction === 'long'
        ? l.side === 'buy_side' && !l.swept && l.price > entryPrice
        : l.side === 'sell_side' && !l.swept && l.price < entryPrice
    )
    .sort((a, b) =>
      direction === 'long' ? a.price - b.price : b.price - a.price
    )
    .slice(0, 3)
    .map((l) => `${l.side === 'buy_side' ? 'BSL' : 'SSL'} at ${round(l.price)}`);

  const lastBosEvent = [...ltfAnalysis.structureEvents]
    .reverse()
    .find((e) => e.type === 'BOS');
  const lastChochEvent = [...ltfAnalysis.structureEvents]
    .reverse()
    .find((e) => e.type === 'CHoCH');

  const setup: StructuredSetupPayload = {
    id: `setup-${symbol}-${entryTimeframe}-${lastCandle.time}`,
    symbol,
    timeframe_entry: entryTimeframe,
    htf_bias: htfBias,
    mtf_structure: mtfStructure,
    session: ltfAnalysis.killzone.id,
    session_label: ltfAnalysis.killzone.label,
    direction,
    candle_time: lastCandle.time,
    entry_price: round(entryPrice),
    stop_loss: round(stopLoss),
    take_profit: round(takeProfit),
    setup: {
      sweep: recentSweep
        ? `${recentSweep.side === 'sell_side' ? 'sell-side' : 'buy-side'} liquidity at ${round(
            recentSweep.levelPrice
          )}`
        : null,
      choch: Boolean(recentChoch),
      bos: Boolean(recentBos),
      last_bos: lastBosEvent
        ? `${lastBosEvent.direction} BOS breaking ${round(lastBosEvent.brokenPrice)}`
        : null,
      last_choch: lastChochEvent
        ? `${lastChochEvent.direction} CHoCH breaking ${round(lastChochEvent.brokenPrice)}`
        : null,
      ltf_trend: ltfAnalysis.trend,
      displacement_confirmed: displacementConfirmed,
      resting_targets: restingTargets,
      nearest_support: nearestSupport !== null ? round(nearestSupport) : null,
      nearest_resistance: nearestResistance !== null ? round(nearestResistance) : null,
      rejection_wick_ratio: rejectionWickRatio,
      fvg: activeFvg
        ? {
            type: activeFvg.type,
            range: [round(activeFvg.bottom), round(activeFvg.top)],
          }
        : null,
      order_block: activeOb
        ? {
            type: activeOb.type,
            range: [round(activeOb.bottom), round(activeOb.top)],
          }
        : null,
      in_discount: inDiscount,
      in_premium: inPremium,
      in_ote: inOte,
      in_killzone: ltfAnalysis.killzone.inKillzone,
      rr_estimate: Number(rrEstimate.toFixed(2)),
    },
    recent_news_risk: 'none',
  };

  return {
    ltfAnalysis,
    htfBias,
    mtfStructure,
    setup,
  };
}

export function buildAnalystInputPayload(
  setup: StructuredSetupPayload,
  options?: {
    language?: 'en' | 'km';
    csnrRule?: CSNRRuleConfig | null;
    newsRisk?: NewsRiskLevel;
  }
): StructuredAnalystInput {
  const session: StructuredAnalystInput['session'] =
    setup.session === 'london_killzone'
      ? 'london_killzone'
      : setup.session === 'new_york_killzone'
      ? 'new_york_killzone'
      : setup.session === 'asia_killzone'
      ? 'asia'
      : 'off_session';

  const poi: StructuredAnalystInput['poi'] = setup.setup.fvg
    ? {
        type: 'FVG',
        range: setup.setup.fvg.range,
        direction: setup.setup.fvg.type,
      }
    : setup.setup.order_block
    ? {
        type: 'OB',
        range: setup.setup.order_block.range,
        direction: setup.setup.order_block.type,
      }
    : null;

  const priceZone: StructuredAnalystInput['price_zone'] = setup.setup.in_premium
    ? 'premium'
    : setup.setup.in_discount
    ? 'discount'
    : 'equilibrium';

  const hasCsnrDef = Boolean(
    options?.csnrRule?.definition?.trim() || options?.csnrRule?.evaluationRules?.trim()
  );

  return {
    language: options?.language === 'km' ? 'km' : 'en',
    symbol: setup.symbol,
    htf_bias: setup.htf_bias,
    entry_timeframe: setup.timeframe_entry,
    session,
    structure: {
      last_bos: setup.setup.last_bos,
      last_choch: setup.setup.last_choch,
      trend: setup.setup.ltf_trend,
      displacement_confirmed: setup.setup.displacement_confirmed,
    },
    liquidity: {
      swept: setup.setup.sweep,
      resting_targets: setup.setup.resting_targets,
    },
    poi,
    price_zone: priceZone,
    ote_in_zone: setup.setup.in_ote,
    csnr: {
      defined: hasCsnrDef,
      definition: hasCsnrDef ? options?.csnrRule?.definition?.trim() || null : null,
      evaluation_rules: hasCsnrDef
        ? options?.csnrRule?.evaluationRules?.trim() || null
        : null,
      grade_fit: hasCsnrDef ? options?.csnrRule?.gradeFit || 'confluence' : null,
      nearest_support: setup.setup.nearest_support,
      nearest_resistance: setup.setup.nearest_resistance,
      rejection_wick_ratio: setup.setup.rejection_wick_ratio,
    },
    proposed_entry: setup.entry_price,
    proposed_stop: setup.stop_loss,
    proposed_targets: [setup.take_profit],
    rr: setup.setup.rr_estimate,
    news_risk: options?.newsRisk ?? (setup.recent_news_risk === 'elevated' ? 'high' : 'none'),
  };
}
