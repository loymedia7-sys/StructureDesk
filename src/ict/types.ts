export type Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D';

export type MarketSymbol = 'XAUUSD' | 'EURUSD' | 'GBPUSD' | 'USDJPY' | 'BTCUSDT';

export type TrendBias = 'bullish' | 'bearish' | 'neutral';

export type KillzoneId =
  | 'asia_killzone'
  | 'london_killzone'
  | 'new_york_killzone'
  | 'london_close'
  | 'off_session';

export interface Candle {
  time: number; // Unix timestamp in seconds (closed candle open time)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: 'high' | 'low';
}

export interface StructureEvent {
  index: number;
  time: number;
  type: 'BOS' | 'CHoCH';
  direction: 'bullish' | 'bearish';
  brokenPrice: number;
  brokenSwingIndex: number;
  closePrice: number;
}

export interface FairValueGap {
  id: string;
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  midpoint: number;
  startIndex: number;
  startTime: number;
  endTime: number;
  mitigated: boolean;
  mitigatedIndex: number | null;
}

export interface OrderBlock {
  id: string;
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  candleIndex: number;
  time: number;
  causeEvent: 'BOS' | 'CHoCH';
  mitigated: boolean;
  mitigatedIndex: number | null;
}

export interface LiquidityLevel {
  id: string;
  side: 'buy_side' | 'sell_side'; // buy_side = equal highs / swing highs; sell_side = equal lows / swing lows
  price: number;
  count: number;
  indices: number[];
  times: number[];
  swept: boolean;
}

export interface LiquiditySweep {
  id: string;
  side: 'buy_side' | 'sell_side';
  levelPrice: number;
  sweepExtreme: number;
  candleIndex: number;
  time: number;
}

export interface DealingRange {
  swingHigh: number;
  swingHighIndex: number;
  swingLow: number;
  swingLowIndex: number;
  equilibrium: number; // 50%
  oteBullishTop: number; // 62% retracement from high toward low
  oteBullishBottom: number; // 79% retracement from high toward low
  oteBearishBottom: number; // 62% retracement from low toward high
  oteBearishTop: number; // 79% retracement from low toward high
  currentPrice: number;
  zone: 'discount' | 'premium';
  retracementPct: number;
}

export interface KillzoneInfo {
  id: KillzoneId;
  label: string;
  inKillzone: boolean;
  utcHour: number;
}

export interface ICTEngineAnalysis {
  symbol: MarketSymbol;
  timeframe: Timeframe;
  swings: SwingPoint[];
  structureEvents: StructureEvent[];
  trend: TrendBias;
  fvgs: FairValueGap[];
  orderBlocks: OrderBlock[];
  liquidityLevels: LiquidityLevel[];
  sweeps: LiquiditySweep[];
  dealingRange: DealingRange | null;
  killzone: KillzoneInfo;
}

export type NewsRiskLevel = 'none' | 'low' | 'high';

export interface CSNRRuleConfig {
  definition: string;
  evaluationRules: string;
  gradeFit: 'confluence' | 'confirmation' | 'hard_requirement';
}

export interface StructuredAnalystInput {
  language: 'en' | 'km';
  symbol: MarketSymbol;
  htf_bias: TrendBias;
  entry_timeframe: Timeframe;
  session: 'london_killzone' | 'new_york_killzone' | 'asia' | 'off_session';
  structure: {
    last_bos: string | null;
    last_choch: string | null;
    trend: TrendBias;
    displacement_confirmed: boolean;
  };
  liquidity: {
    swept: string | null;
    resting_targets: string[];
  };
  poi: {
    type: 'OB' | 'FVG' | 'breaker';
    range: [number, number];
    direction: 'bullish' | 'bearish';
  } | null;
  price_zone: 'premium' | 'discount' | 'equilibrium';
  ote_in_zone: boolean;
  csnr: {
    defined: boolean;
    definition: string | null;
    evaluation_rules: string | null;
    grade_fit: string | null;
    nearest_support: number | null;
    nearest_resistance: number | null;
    rejection_wick_ratio: number;
  };
  proposed_entry: number;
  proposed_stop: number;
  proposed_targets: number[];
  rr: number;
  news_risk: NewsRiskLevel;
}

export interface StructuredSetupPayload {
  id: string;
  symbol: MarketSymbol;
  timeframe_entry: Timeframe;
  htf_bias: TrendBias;
  mtf_structure: TrendBias;
  session: KillzoneId;
  session_label: string;
  direction: 'long' | 'short';
  candle_time: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  setup: {
    sweep: string | null;
    choch: boolean;
    bos: boolean;
    last_bos: string | null;
    last_choch: string | null;
    ltf_trend: TrendBias;
    displacement_confirmed: boolean;
    resting_targets: string[];
    nearest_support: number | null;
    nearest_resistance: number | null;
    rejection_wick_ratio: number;
    fvg: { type: 'bullish' | 'bearish'; range: [number, number] } | null;
    order_block: { type: 'bullish' | 'bearish'; range: [number, number] } | null;
    in_discount: boolean;
    in_premium: boolean;
    in_ote: boolean;
    in_killzone: boolean;
    rr_estimate: number;
  };
  recent_news_risk: 'none' | 'elevated';
}

export interface AIAnalysisResult {
  grade: 'A' | 'B' | 'C' | 'reject';
  score: number;
  bias_alignment: 'aligned' | 'conflicting' | 'neutral';
  confluences: string[];
  missing_elements: string[];
  risks: string[];
  invalidation: string;
  explanation_en: string;
  explanation_km: string;
  disclaimer: string;
  explanation: string;
  khmer_summary?: string;
  model: string;
  analyzedAt: string;
}

export interface RiskSettings {
  accountBalance: number;
  riskPercent: number;
  minRR: number;
  cooldownCandles: number;
  dailyLossLimitPercent: number;
  maxOpenSignals: number;
}

export interface PositionSizingResult {
  riskAmount: number;
  stopDistance: number;
  stopPips: number;
  recommendedUnits: number;
  recommendedLots: number;
  rrRatio: number;
  passesMinRR: boolean;
}

export interface PersistedSignal {
  id: string;
  symbol: MarketSymbol;
  timeframe: Timeframe;
  direction: 'long' | 'short';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  rrRatio: number;
  recommendedLots: number;
  riskAmount: number;
  aiGrade: 'A' | 'B' | 'C' | 'reject' | 'Rules-Only';
  aiScore: number | null;
  explanation: string;
  khmerSummary?: string;
  sessionLabel: string;
  htfBias: TrendBias;
  status: 'Active' | 'TP Hit' | 'SL Hit' | 'Closed';
  candleTime: number;
  createdAt: string;
  setupSnapshot: StructuredSetupPayload;
}

export interface BacktestConfig {
  symbol: MarketSymbol;
  timeframe: Timeframe;
  minRR: number;
  requireKillzone: boolean;
  requireHTFAlignment: boolean;
  riskPercent: number;
  startingBalance: number;
  cooldownCandles: number;
}

export interface BacktestTrade {
  id: string;
  entryIndex: number;
  exitIndex: number;
  entryTime: number;
  exitTime: number;
  direction: 'long' | 'short';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice: number;
  outcome: 'win' | 'loss';
  rMultiple: number;
  pnlDollar: number;
  balanceAfter: number;
  sessionLabel: string;
  confluences: string[];
}

export interface BacktestReport {
  config: BacktestConfig;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgRR: number;
  expectancyR: number;
  profitFactor: number;
  maxDrawdownPct: number;
  netReturnPct: number;
  finalBalance: number;
  equityCurve: { time: number; balance: number }[];
  trades: BacktestTrade[];
}
