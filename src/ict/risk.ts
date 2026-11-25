import type {
  MarketSymbol,
  PersistedSignal,
  PositionSizingResult,
  RiskSettings,
  StructuredSetupPayload,
} from './types';

export function getSymbolContractSpec(symbol: MarketSymbol): {
  pipSize: number;
  decimals: number;
  unitsPerLot: number;
  pipValuePerStandardLot: number;
} {
  switch (symbol) {
    case 'XAUUSD':
      return { pipSize: 0.1, decimals: 2, unitsPerLot: 100, pipValuePerStandardLot: 10 };
    case 'USDJPY':
      return { pipSize: 0.01, decimals: 3, unitsPerLot: 100_000, pipValuePerStandardLot: 9.1 };
    case 'BTCUSDT':
      return { pipSize: 1.0, decimals: 2, unitsPerLot: 1, pipValuePerStandardLot: 1 };
    case 'EURUSD':
    case 'GBPUSD':
    default:
      return { pipSize: 0.0001, decimals: 5, unitsPerLot: 100_000, pipValuePerStandardLot: 10 };
  }
}

export function calculatePositionSize(params: {
  symbol: MarketSymbol;
  accountBalance: number;
  riskPercent: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  minRR: number;
}): PositionSizingResult {
  const { symbol, accountBalance, riskPercent, entryPrice, stopLoss, takeProfit, minRR } = params;
  const spec = getSymbolContractSpec(symbol);

  const riskAmount = Math.max(0, accountBalance * (riskPercent / 100));
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const rewardDistance = Math.abs(takeProfit - entryPrice);
  const rrRatio = stopDistance > 0 ? rewardDistance / stopDistance : 0;

  const stopPips = stopDistance / spec.pipSize;
  const recommendedUnits = stopDistance > 0 ? riskAmount / stopDistance : 0;
  const recommendedLots =
    stopPips > 0
      ? Math.max(0.01, Number((riskAmount / (stopPips * spec.pipValuePerStandardLot)).toFixed(2)))
      : 0;

  return {
    riskAmount: Number(riskAmount.toFixed(2)),
    stopDistance: Number(stopDistance.toFixed(spec.decimals)),
    stopPips: Number(stopPips.toFixed(1)),
    recommendedUnits: Number(recommendedUnits.toFixed(2)),
    recommendedLots,
    rrRatio: Number(rrRatio.toFixed(2)),
    passesMinRR: rrRatio >= minRR,
  };
}

export function checkSignalEligibility(params: {
  setup: StructuredSetupPayload;
  existingSignals: PersistedSignal[];
  settings: RiskSettings;
  currentCandleIndex?: number;
}): { allowed: boolean; reasons: string[] } {
  const { setup, existingSignals, settings } = params;
  const reasons: string[] = [];

  if (setup.setup.rr_estimate < settings.minRR) {
    reasons.push(
      `Reward-to-Risk (${setup.setup.rr_estimate.toFixed(2)}:1) is below minimum ${settings.minRR}:1`
    );
  }

  const activeSignals = existingSignals.filter((s) => s.status === 'Active');
  if (activeSignals.length >= settings.maxOpenSignals) {
    reasons.push(
      `Maximum concurrent open signals (${settings.maxOpenSignals}) reached`
    );
  }

  // Cooldown / deduplication check on same symbol, direction, and approximate zone
  const duplicate = existingSignals.find((s) => {
    const samePair = s.symbol === setup.symbol && s.direction === setup.direction;
    const closeInTime = Math.abs(s.candleTime - setup.candle_time) < settings.cooldownCandles * 300;
    const priceDiffPct = Math.abs(s.entryPrice - setup.entry_price) / setup.entry_price;
    return samePair && (closeInTime || priceDiffPct < 0.0015) && s.status === 'Active';
  });

  if (duplicate) {
    reasons.push(
      `Cooldown active: an open ${setup.direction} signal already exists near this zone`
    );
  }

  // Daily loss limit check from today's SL hits
  const today = new Date().toISOString().slice(0, 10);
  const todaysLosses = existingSignals
    .filter((s) => s.status === 'SL Hit' && s.createdAt.slice(0, 10) === today)
    .reduce((sum, s) => sum + s.riskAmount, 0);
  const maxDailyLoss = settings.accountBalance * (settings.dailyLossLimitPercent / 100);
  if (todaysLosses >= maxDailyLoss && maxDailyLoss > 0) {
    reasons.push(
      `Daily loss limit ($${maxDailyLoss.toFixed(0)}) reached for today`
    );
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}
