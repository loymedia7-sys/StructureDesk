import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  generateInstitutionalDataset,
  timeframeSeconds,
  type ReplayScenarioId,
} from './src/ict/candles';
import { buildAnalystInputPayload } from './src/ict/engine';
import type {
  AIAnalysisResult,
  CSNRRuleConfig,
  Candle,
  MarketSymbol,
  NewsRiskLevel,
  PersistedSignal,
  StructuredSetupPayload,
  Timeframe,
} from './src/ict/types';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const SIGNALS_FILE = path.join(DATA_DIR, 'signals.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readSignals(): PersistedSignal[] {
  ensureDataDir();
  if (!fs.existsSync(SIGNALS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(SIGNALS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSignals(signals: PersistedSignal[]) {
  ensureDataDir();
  fs.writeFileSync(SIGNALS_FILE, JSON.stringify(signals, null, 2), 'utf-8');
}

function getSymbolDecimals(symbol: MarketSymbol): number {
  switch (symbol) {
    case 'XAUUSD':
    case 'BTCUSDT':
      return 2;
    case 'USDJPY':
      return 3;
    case 'EURUSD':
    case 'GBPUSD':
      return 5;
  }
}

function roundPrice(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function mapTimeframeToBinance(tf: Timeframe): string {
  switch (tf) {
    case '1m':
      return '1m';
    case '5m':
      return '5m';
    case '15m':
      return '15m';
    case '1H':
      return '1h';
    case '4H':
      return '4h';
    case '1D':
      return '1d';
  }
}

function mapTimeframeToOkx(tf: Timeframe): string {
  switch (tf) {
    case '1m':
      return '1m';
    case '5m':
      return '5m';
    case '15m':
      return '15m';
    case '1H':
      return '1H';
    case '4H':
      return '4H';
    case '1D':
      return '1D';
  }
}

function mapSymbolToSwissquote(symbol: MarketSymbol): string | null {
  switch (symbol) {
    case 'XAUUSD':
      return 'XAU/USD';
    case 'EURUSD':
      return 'EUR/USD';
    case 'GBPUSD':
      return 'GBP/USD';
    case 'USDJPY':
      return 'USD/JPY';
    case 'BTCUSDT':
      return null;
  }
}

function mapSymbolToYahoo(symbol: MarketSymbol): string {
  switch (symbol) {
    case 'XAUUSD':
      return 'GC=F';
    case 'EURUSD':
      return 'EURUSD=X';
    case 'GBPUSD':
      return 'GBPUSD=X';
    case 'USDJPY':
      return 'JPY=X';
    case 'BTCUSDT':
      return 'BTC-USD';
  }
}

function mapTimeframeToYahoo(tf: Timeframe): { interval: string; range: string } {
  switch (tf) {
    case '1m':
      return { interval: '1m', range: '1d' };
    case '5m':
      return { interval: '5m', range: '5d' };
    case '15m':
      return { interval: '15m', range: '5d' };
    case '1H':
      return { interval: '60m', range: '1mo' };
    case '4H':
      return { interval: '60m', range: '3mo' };
    case '1D':
      return { interval: '1d', range: '1y' };
  }
}

interface SpotQuote {
  bid: number;
  ask: number;
  mid: number;
  ts: number;
}

async function fetchSwissquoteSpot(
  symbol: MarketSymbol,
  signal?: AbortSignal
): Promise<SpotQuote | null> {
  const pair = mapSymbolToSwissquote(symbol);
  if (!pair) return null;

  const res = await fetch(
    `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${pair}`,
    {
      signal: signal ?? AbortSignal.timeout(2500),
      headers: { Accept: 'application/json' },
    }
  );
  if (!res.ok) return null;

  const data = (await res.json()) as Array<{
    spreadProfilePrices?: Array<{
      spreadProfile?: string;
      bid?: number;
      ask?: number;
    }>;
    ts?: number;
  }>;

  if (!Array.isArray(data) || data.length === 0) return null;

  let chosenPrice: { bid: number; ask: number } | null = null;
  let chosenTs = Date.now();

  for (const venue of data) {
    const profiles = venue?.spreadProfilePrices ?? [];
    const elite = profiles.find((p) => p.spreadProfile === 'elite');
    const prime = profiles.find((p) => p.spreadProfile === 'prime');
    const pick = elite ?? prime ?? profiles[0];
    if (
      pick &&
      typeof pick.bid === 'number' &&
      typeof pick.ask === 'number' &&
      Number.isFinite(pick.bid) &&
      Number.isFinite(pick.ask)
    ) {
      chosenPrice = { bid: pick.bid, ask: pick.ask };
      chosenTs = typeof venue.ts === 'number' ? venue.ts : Date.now();
      if (elite) break;
    }
  }

  if (!chosenPrice) return null;
  const decimals = getSymbolDecimals(symbol);
  return {
    bid: roundPrice(chosenPrice.bid, decimals),
    ask: roundPrice(chosenPrice.ask, decimals),
    mid: roundPrice((chosenPrice.bid + chosenPrice.ask) / 2, decimals),
    ts: chosenTs,
  };
}

function bucketCandles(raw: Candle[], tfSec: number): Candle[] {
  const byBucket = new Map<number, Candle>();
  for (const c of raw) {
    const bucketTime = Math.floor(c.time / tfSec) * tfSec;
    const existing = byBucket.get(bucketTime);
    if (!existing) {
      byBucket.set(bucketTime, { ...c, time: bucketTime });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume += c.volume;
    }
  }
  return Array.from(byBucket.values()).sort((a, b) => a.time - b.time);
}

function parseYahooBars(payload: any, tfSec: number): Candle[] {
  const result = payload?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const metaPrice: number | undefined = result?.meta?.regularMarketPrice;

  if (!quote || timestamps.length === 0) {
    throw new Error('Empty Yahoo Finance candle array');
  }

  const raw: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    const v = quote.volume?.[i] ?? 0;
    if (
      typeof o === 'number' &&
      typeof h === 'number' &&
      typeof l === 'number' &&
      typeof c === 'number'
    ) {
      raw.push({
        time: timestamps[i],
        open: o,
        high: h,
        low: l,
        close: c,
        volume: typeof v === 'number' ? v : 0,
      });
    }
  }

  const bucketed = bucketCandles(raw, tfSec);
  if (bucketed.length > 0 && typeof metaPrice === 'number' && Number.isFinite(metaPrice)) {
    const last = bucketed[bucketed.length - 1];
    last.close = metaPrice;
    last.high = Math.max(last.high, metaPrice);
    last.low = Math.min(last.low, metaPrice);
  }

  return bucketed.slice(-161);
}

async function fetchOkxXautCandles(
  bar: string,
  limit: number,
  signal?: AbortSignal
): Promise<Candle[]> {
  const res = await fetch(
    `https://www.okx.com/api/v5/market/candles?instId=XAUT-USDT&bar=${encodeURIComponent(
      bar
    )}&limit=${limit}`,
    { signal }
  );
  if (!res.ok) {
    throw new Error(`OKX XAUT-USDT returned ${res.status}`);
  }
  const payload = (await res.json()) as { code?: string; data?: string[][] };
  if (payload.code !== '0' || !Array.isArray(payload.data) || payload.data.length === 0) {
    throw new Error('Empty OKX XAUT-USDT candle array');
  }

  // OKX returns newest-first; sort ascending chronologically
  return payload.data
    .map((r) => ({
      time: Math.floor(Number(r[0]) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    }))
    .sort((a, b) => a.time - b.time);
}

function shiftCandlesOffset(candles: Candle[], offset: number, decimals: number): Candle[] {
  if (!Number.isFinite(offset) || offset === 0) return candles;
  return candles.map((c) => ({
    ...c,
    open: roundPrice(c.open + offset, decimals),
    high: roundPrice(c.high + offset, decimals),
    low: roundPrice(c.low + offset, decimals),
    close: roundPrice(c.close + offset, decimals),
  }));
}

function mergeSpotIntoBars(
  bars: Candle[],
  tfSec: number,
  spot: SpotQuote | null,
  decimals: number
): { closedLtf: Candle[]; formingCandle: Candle } {
  const nowSec = spot ? Math.floor(spot.ts / 1000) : Math.floor(Date.now() / 1000);
  const currentBucket = Math.floor(nowSec / tfSec) * tfSec;

  const closedLtf = bars.filter((b) => b.time < currentBucket).slice(-160);
  const existingForming = bars.find((b) => b.time === currentBucket);
  const prevClose = closedLtf[closedLtf.length - 1]?.close ?? bars[bars.length - 1]?.close ?? 0;

  if (!spot) {
    const fallbackForming = existingForming ?? bars[bars.length - 1];
    return {
      closedLtf: closedLtf.length >= 20 ? closedLtf : bars.slice(0, -1),
      formingCandle: fallbackForming,
    };
  }

  const price = roundPrice(spot.mid, decimals);
  const formingCandle: Candle = existingForming
    ? {
        time: currentBucket,
        open: roundPrice(existingForming.open, decimals),
        high: roundPrice(Math.max(existingForming.high, price), decimals),
        low: roundPrice(Math.min(existingForming.low, price), decimals),
        close: price,
        volume: existingForming.volume,
      }
    : {
        time: currentBucket,
        open: roundPrice(prevClose || price, decimals),
        high: roundPrice(Math.max(prevClose || price, price), decimals),
        low: roundPrice(Math.min(prevClose || price, price), decimals),
        close: price,
        volume: 0,
      };

  return {
    closedLtf: closedLtf.length >= 20 ? closedLtf : bars.slice(0, -1),
    formingCandle,
  };
}

interface LiveCandleBundle {
  ltfCandles: Candle[];
  formingCandle: Candle | null;
  mtfCandles: Candle[];
  htfCandles: Candle[];
  provider: string;
  bid?: number;
  ask?: number;
}

async function fetchLiveCandles(
  symbol: MarketSymbol,
  timeframe: Timeframe
): Promise<LiveCandleBundle> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);
  const tfSec = timeframeSeconds(timeframe);
  const decimals = getSymbolDecimals(symbol);

  try {
    if (symbol === 'BTCUSDT') {
      const interval = mapTimeframeToBinance(timeframe);
      const [ltfRes, mtfRes, htfRes] = await Promise.all([
        fetch(
          `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=161`,
          { signal: controller.signal }
        ),
        fetch(
          `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=120`,
          { signal: controller.signal }
        ),
        fetch(
          `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=100`,
          { signal: controller.signal }
        ),
      ]);

      if (!ltfRes.ok || !mtfRes.ok || !htfRes.ok) {
        throw new Error(`Binance returned status ${ltfRes.status}`);
      }

      const parseBinanceAll = (rows: unknown[][]): Candle[] =>
        rows.map((r) => ({
          time: Math.floor(Number(r[0]) / 1000),
          open: Number(r[1]),
          high: Number(r[2]),
          low: Number(r[3]),
          close: Number(r[4]),
          volume: Number(r[5]),
        }));

      const [ltfJson, mtfJson, htfJson] = await Promise.all([
        ltfRes.json(),
        mtfRes.json(),
        htfRes.json(),
      ]);

      const allLtf = parseBinanceAll(ltfJson);
      const formingCandle = allLtf.length > 1 ? allLtf[allLtf.length - 1] : null;
      const closedLtf = allLtf.length > 1 ? allLtf.slice(0, -1) : allLtf;

      return {
        ltfCandles: closedLtf,
        formingCandle,
        mtfCandles: parseBinanceAll(mtfJson).slice(0, -1),
        htfCandles: parseBinanceAll(htfJson).slice(0, -1),
        provider: 'Binance Live WebSocket (BINANCE:BTCUSDT)',
      };
    }

    if (symbol === 'XAUUSD') {
      const okxBar = mapTimeframeToOkx(timeframe);
      const [spotQuote, okxLtf, okxMtf, okxHtf] = await Promise.all([
        fetchSwissquoteSpot('XAUUSD', controller.signal).catch(() => null),
        fetchOkxXautCandles(okxBar, 165, controller.signal),
        fetchOkxXautCandles('1H', 120, controller.signal),
        fetchOkxXautCandles('4H', 100, controller.signal),
      ]);

      const rawLatest = okxLtf[okxLtf.length - 1];
      const spotOffset =
        spotQuote && rawLatest && Math.abs(spotQuote.mid - rawLatest.close) < 200
          ? roundPrice(spotQuote.mid - rawLatest.close, decimals)
          : 0;

      const alignedLtf = shiftCandlesOffset(okxLtf, spotOffset, decimals);
      const alignedMtf = shiftCandlesOffset(okxMtf, spotOffset, decimals).slice(0, -1);
      const alignedHtf = shiftCandlesOffset(okxHtf, spotOffset, decimals).slice(0, -1);

      const { closedLtf, formingCandle } = mergeSpotIntoBars(
        alignedLtf,
        tfSec,
        spotQuote,
        decimals
      );

      return {
        ltfCandles: closedLtf,
        formingCandle,
        mtfCandles: alignedMtf.length >= 20 ? alignedMtf : closedLtf,
        htfCandles: alignedHtf.length >= 20 ? alignedHtf : closedLtf,
        provider: spotQuote
          ? 'Swissquote Spot XAU/USD (Real-Time BBO)'
          : 'Spot Gold Proxy (XAUT-USDT)',
        bid: spotQuote?.bid,
        ask: spotQuote?.ask,
      };
    }

    const yahooSym = mapSymbolToYahoo(symbol);
    const { interval, range } = mapTimeframeToYahoo(timeframe);
    const [spotQuote, ltfRes, mtfRes, htfRes] = await Promise.all([
      fetchSwissquoteSpot(symbol, controller.signal).catch(() => null),
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          yahooSym
        )}?interval=${interval}&range=${range}`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }
      ),
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          yahooSym
        )}?interval=60m&range=1mo`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }
      ),
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          yahooSym
        )}?interval=1d&range=6mo`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }
      ),
    ]);

    if (!ltfRes.ok) {
      throw new Error(`FX history returned status ${ltfRes.status}`);
    }

    const [ltfPayload, mtfPayload, htfPayload] = await Promise.all([
      ltfRes.json(),
      mtfRes.json(),
      htfRes.json(),
    ]);

    const allLtf = parseYahooBars(ltfPayload, tfSec);
    const mtfCandles = parseYahooBars(mtfPayload, 3600).slice(0, -1);
    const htfCandles = parseYahooBars(htfPayload, 86400).slice(0, -1);

    if (allLtf.length < 20) {
      throw new Error('Insufficient live closed candles returned');
    }

    const { closedLtf, formingCandle } = mergeSpotIntoBars(
      allLtf,
      tfSec,
      spotQuote,
      decimals
    );

    const sqPair = mapSymbolToSwissquote(symbol);
    return {
      ltfCandles: closedLtf,
      formingCandle,
      mtfCandles: mtfCandles.length >= 20 ? mtfCandles : closedLtf,
      htfCandles: htfCandles.length >= 20 ? htfCandles : closedLtf,
      provider: spotQuote
        ? `Swissquote Spot ${sqPair} (Real-Time BBO)`
        : `Yahoo Finance FX (${yahooSym})`,
      bid: spotQuote?.bid,
      ask: spotQuote?.ask,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isSafeHttpsWebhook(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get(['/api/health', '/health'], (_req, res) => {
    res.json({
      ok: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.get('/api/candles', async (req, res) => {
    const symbol = (String(req.query.symbol || 'XAUUSD') as MarketSymbol);
    const timeframe = (String(req.query.timeframe || '5m') as Timeframe);
    const source = String(req.query.source || 'live');
    const scenario = (String(req.query.scenario || 'london_bullish_sweep') as ReplayScenarioId);

    const validSymbols: MarketSymbol[] = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT'];
    const validTfs: Timeframe[] = ['1m', '5m', '15m', '1H', '4H', '1D'];

    if (!validSymbols.includes(symbol) || !validTfs.includes(timeframe)) {
      res.status(400).json({ error: 'Unsupported symbol or timeframe.' });
      return;
    }

    if (source === 'live') {
      try {
        const liveData = await fetchLiveCandles(symbol, timeframe);
        res.json({
          symbol,
          timeframe,
          feedSource: 'live',
          provider: liveData.provider,
          ltfCandles: liveData.ltfCandles,
          formingCandle: liveData.formingCandle,
          mtfCandles: liveData.mtfCandles,
          htfCandles: liveData.htfCandles,
        });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Live market feed unreachable';
        const fallback = generateInstitutionalDataset({
          symbol,
          timeframe,
          count: 160,
          scenario,
        });
        res.json({
          symbol,
          timeframe,
          feedSource: 'replay',
          provider: 'Institutional Replay Fallback',
          warning: `Live feed unavailable (${msg}). Showing deterministic closed-candle replay.`,
          formingCandle: null,
          ...fallback,
        });
        return;
      }
    }

    const dataset = generateInstitutionalDataset({
      symbol,
      timeframe,
      count: 160,
      scenario,
    });

    res.json({
      symbol,
      timeframe,
      feedSource: 'replay',
      provider: 'Institutional Closed-Candle Store',
      formingCandle: null,
      ...dataset,
    });
  });

  // Real-time Server-Sent Events (SSE) market stream
  app.get('/api/stream', async (req, res) => {
    const symbol = (String(req.query.symbol || 'XAUUSD') as MarketSymbol);
    const timeframe = (String(req.query.timeframe || '5m') as Timeframe);
    const validSymbols: MarketSymbol[] = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSDT'];
    const validTfs: Timeframe[] = ['1m', '5m', '15m', '1H', '4H', '1D'];

    if (!validSymbols.includes(symbol) || !validTfs.includes(timeframe)) {
      res.status(400).json({ error: 'Unsupported symbol or timeframe.' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    let closed = false;
    let binanceWs: WebSocket | null = null;
    let sleepTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const sendEvent = (event: string, data: unknown) => {
      if (closed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (sleepTimer) clearTimeout(sleepTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (binanceWs) {
        try {
          binanceWs.close();
        } catch {
          // ignore
        }
      }
    };

    req.on('close', cleanup);

    try {
      const initial = await fetchLiveCandles(symbol, timeframe);
      if (closed) return;

      sendEvent('snapshot', {
        symbol,
        timeframe,
        feedSource: 'live',
        provider: initial.provider,
        ltfCandles: initial.ltfCandles,
        formingCandle: initial.formingCandle,
        mtfCandles: initial.mtfCandles,
        htfCandles: initial.htfCandles,
        bid: initial.bid,
        ask: initial.ask,
        serverTime: Date.now(),
      });

      heartbeatTimer = setInterval(() => {
        if (!closed) {
          res.write(`: heartbeat ${Date.now()}\n\n`);
        }
      }, 15000);

      if (symbol === 'BTCUSDT' && typeof globalThis.WebSocket === 'function') {
        const interval = mapTimeframeToBinance(timeframe);
        let currentForming: Candle | null = initial.formingCandle
          ? { ...initial.formingCandle }
          : null;
        let lastEmitAt = 0;

        binanceWs = new globalThis.WebSocket(
          `wss://stream.binance.com:9443/stream?streams=btcusdt@kline_${interval}/btcusdt@aggTrade`
        );
        binanceWs.onmessage = (msg) => {
          if (closed) return;
          try {
            const envelope = JSON.parse(String(msg.data));
            const payload = envelope?.data ?? envelope;
            if (!payload) return;

            if (payload.e === 'kline' && payload.k) {
              const k = payload.k;
              const candle: Candle = {
                time: Math.floor(Number(k.t) / 1000),
                open: Number(k.o),
                high: Number(k.h),
                low: Number(k.l),
                close: Number(k.c),
                volume: Number(k.v),
              };
              const isClosed = Boolean(k.x);
              currentForming = isClosed ? null : candle;
              lastEmitAt = Date.now();
              sendEvent('tick', {
                formingCandle: isClosed ? null : candle,
                closedCandle: isClosed ? candle : null,
                serverTime: lastEmitAt,
              });
              return;
            }

            if (payload.e === 'aggTrade' && currentForming) {
              const price = Number(payload.p);
              if (!Number.isFinite(price)) return;
              currentForming = {
                ...currentForming,
                high: Math.max(currentForming.high, price),
                low: Math.min(currentForming.low, price),
                close: price,
              };
              const now = Date.now();
              if (now - lastEmitAt >= 120) {
                lastEmitAt = now;
                sendEvent('tick', {
                  formingCandle: currentForming,
                  closedCandle: null,
                  serverTime: now,
                });
              }
            }
          } catch {
            // ignore malformed ws frame
          }
        };
      } else {
        const tfSec = timeframeSeconds(timeframe);
        const decimals = getSymbolDecimals(symbol);
        let currentForming: Candle | null = initial.formingCandle
          ? { ...initial.formingCandle }
          : null;
        let lastMid = initial.formingCandle?.close ?? 0;
        let lastBid = initial.bid ?? 0;
        let lastAsk = initial.ask ?? 0;

        const runSpotLoop = async () => {
          while (!closed) {
            try {
              const spot = await fetchSwissquoteSpot(symbol);
              if (closed) break;

              if (spot) {
                const quoteSec = Math.floor(spot.ts / 1000);
                const bucketTime = Math.floor(quoteSec / tfSec) * tfSec;
                const price = roundPrice(spot.mid, decimals);

                if (!currentForming) {
                  currentForming = {
                    time: bucketTime,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    volume: 0,
                  };
                  lastMid = price;
                  lastBid = spot.bid;
                  lastAsk = spot.ask;
                  sendEvent('tick', {
                    formingCandle: currentForming,
                    closedCandle: null,
                    bid: spot.bid,
                    ask: spot.ask,
                    serverTime: Date.now(),
                  });
                } else if (bucketTime > currentForming.time) {
                  const closedBar = { ...currentForming };
                  const prevClose = closedBar.close;
                  currentForming = {
                    time: bucketTime,
                    open: prevClose,
                    high: roundPrice(Math.max(prevClose, price), decimals),
                    low: roundPrice(Math.min(prevClose, price), decimals),
                    close: price,
                    volume: 0,
                  };
                  lastMid = price;
                  lastBid = spot.bid;
                  lastAsk = spot.ask;
                  sendEvent('tick', {
                    formingCandle: currentForming,
                    closedCandle: closedBar,
                    bid: spot.bid,
                    ask: spot.ask,
                    serverTime: Date.now(),
                  });
                } else if (
                  price !== lastMid ||
                  spot.bid !== lastBid ||
                  spot.ask !== lastAsk
                ) {
                  currentForming = {
                    ...currentForming,
                    high: roundPrice(Math.max(currentForming.high, price), decimals),
                    low: roundPrice(Math.min(currentForming.low, price), decimals),
                    close: price,
                  };
                  lastMid = price;
                  lastBid = spot.bid;
                  lastAsk = spot.ask;
                  sendEvent('tick', {
                    formingCandle: currentForming,
                    closedCandle: null,
                    bid: spot.bid,
                    ask: spot.ask,
                    serverTime: Date.now(),
                  });
                }
              }
            } catch {
              // skip transient network glitch and keep streaming
            }

            if (closed) break;
            await new Promise<void>((resolve) => {
              sleepTimer = setTimeout(resolve, 180);
            });
          }
        };

        void runSpotLoop();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to connect live stream';
      const fallback = generateInstitutionalDataset({
        symbol,
        timeframe,
        count: 160,
        scenario: 'london_bullish_sweep',
      });
      sendEvent('fallback', {
        symbol,
        timeframe,
        feedSource: 'replay',
        provider: 'Institutional Replay Fallback',
        warning: `Live stream unavailable (${msg}). Showing deterministic closed-candle replay.`,
        ltfCandles: fallback.ltfCandles,
        formingCandle: null,
        mtfCandles: fallback.mtfCandles,
        htfCandles: fallback.htfCandles,
      });
    }
  });

  let hydrogenCooldownUntil = 0;

  const isTransientGeminiError = (err: unknown): boolean => {
    const status =
      typeof err === 'object' && err !== null && 'status' in err
        ? Number((err as { status?: unknown }).status)
        : NaN;
    if ([429, 500, 502, 503, 504].includes(status)) return true;

    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    return (
      msg.includes('503') ||
      msg.includes('502') ||
      msg.includes('504') ||
      msg.includes('429') ||
      msg.includes('unavailable') ||
      msg.includes('resource_exhausted') ||
      msg.includes('deadline_exceeded') ||
      msg.includes('high demand') ||
      msg.includes('timed out') ||
      msg.includes('timeout') ||
      msg.includes('aborted') ||
      msg.includes('fetch failed') ||
      msg.includes('econnreset')
    );
  };

  const withTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string
  ): Promise<T> => {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  app.post('/api/analyze-setup', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets to enable AI setup grading.',
      });
      return;
    }

    const { setup, language, csnrRule, newsRisk } = req.body as {
      setup?: StructuredSetupPayload;
      language?: 'en' | 'km';
      csnrRule?: CSNRRuleConfig | null;
      newsRisk?: NewsRiskLevel;
    };

    if (!setup || !setup.symbol || !setup.setup) {
      res.status(400).json({ error: 'Valid structured ICT setup payload is required.' });
      return;
    }

    const analystInput = buildAnalystInputPayload(setup, {
      language,
      csnrRule,
      newsRisk,
    });

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          timeout: 15000,
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const csnrBlock = analystInput.csnr.defined
        ? `[CSNR – User Defined Rules]
- Definition: ${analystInput.csnr.definition || 'See evaluation rules'}
- How to evaluate it: ${analystInput.csnr.evaluation_rules || 'Evaluate against input csnr metrics'}
- Where it fits in the grade: ${analystInput.csnr.grade_fit || 'confluence'}`
        : `[CSNR – Not yet defined]
- No custom CSNR rule definition was supplied in the input (csnr.defined = false). Note this in missing_elements and evaluate only the provided objective support/resistance and rejection wick telemetry without inventing rules.`;

      const systemInstruction = `You are an AI market analyst specializing in ICT (Inner Circle Trader) and Smart Money Concepts (SMC). You analyze structured market data that a rules engine provides and produce a clear, disciplined assessment. You do not predict prices with certainty.

## Core rules
1. Use ONLY the data provided in the input. Never invent prices, levels, candles, news, or statistics.
2. If a required element is missing from the input, say so and lower the grade. Do not fill gaps with assumptions.
3. Prefer "no trade" over a weak setup. Most setups should be graded C or reject.
4. Always consider the higher-timeframe bias first. Do not approve a lower-timeframe signal that contradicts it without a strong, explicit reason.
5. Respond in the language requested in the input ("en" or "km"). Keep technical terms in English (for example, FVG, CHoCH, OB, BOS, CSNR, OTE) even in Khmer responses.

## Concepts you evaluate
Market structure:
- Trend: higher highs and higher lows (bullish) or lower highs and lower lows (bearish).
- BOS (Break of Structure): a close beyond the last swing in the trend direction. Trend continuation.
- CHoCH (Change of Character): a break of the last swing against the trend. Possible reversal. Stronger when confirmed by a displacement candle.

Liquidity:
- Buy-side liquidity: resting stops above equal highs or old swing highs.
- Sell-side liquidity: resting stops below equal lows or old swing lows.
- Liquidity sweep: price wicks through a liquidity level and closes back inside. Often precedes a reversal.
- Judas swing: a false move at the session open that sweeps liquidity before the real direction.

Points of Interest (POI):
- Order Block (OB): the last opposing candle before a displacement that causes a BOS. Bullish OB sits below price; bearish OB sits above.
- Fair Value Gap (FVG) / imbalance: a 3-candle gap where candle 1 and candle 3 do not overlap. Price often returns to fill it.
- Breaker block: a failed order block that flips role.

Price range:
- Dealing range: last significant swing low to swing high.
- Premium (above 50%): favor shorts. Discount (below 50%): favor longs.
- OTE (Optimal Trade Entry): the 62% to 79% retracement of the dealing range.

Time:
- Killzones (UTC): London approximately 07:00–10:00, New York approximately 12:00–15:00. Setups inside killzones carry more weight.
- Outside killzones, reduce the score unless the setup is exceptionally clean.

${csnrBlock}

## Grading
Assign a grade based on confluence count and quality:
- A: HTF bias aligned, liquidity sweep present, structure shift (CHoCH or BOS on the entry timeframe), POI in correct premium/discount zone, inside killzone, RR of at least 2:1. Score 80–100.
- B: Most of the above present, one minor element missing. Score 65–79.
- C: Partial setup, multiple missing confluences. Score 40–64. Do not recommend action.
- reject: contradicts HTF bias, no structure shift, RR below 2:1, or data is insufficient. Score below 40.

## Language instruction
- Always provide 'explanation_en' in 2–3 clear sentences in English using only input data.
- When input.language is "km", provide 'explanation_km' in 2–3 clear sentences in Khmer (ភាសាខ្មែរ) keeping ICT terms (FVG, CHoCH, OB, BOS, OTE, CSNR) in English. When input.language is "en", set 'explanation_km' to "".
- Always include a concise educational/non-financial-advice 'disclaimer'.`;

      const skipHydrogen = Date.now() < hydrogenCooldownUntil;
      const modelsToTry: Array<{ model: string; useLowThinking: boolean; timeoutMs: number }> =
        skipHydrogen
          ? [
              { model: 'gemini-3.1-flash-lite', useLowThinking: false, timeoutMs: 14000 },
              { model: 'gemini-3.1-flash-lite', useLowThinking: false, timeoutMs: 14000 },
              { model: 'gemini-3.1-flash-lite', useLowThinking: false, timeoutMs: 14000 },
            ]
          : [
              { model: 'gemini-4-hydrogen', useLowThinking: true, timeoutMs: 9000 },
              { model: 'gemini-3.1-flash-lite', useLowThinking: false, timeoutMs: 14000 },
              { model: 'gemini-3.1-flash-lite', useLowThinking: false, timeoutMs: 14000 },
              { model: 'gemini-3.1-flash-lite', useLowThinking: false, timeoutMs: 14000 },
            ];

      let parsed: Record<string, unknown> | null = null;
      let usedModel = modelsToTry[0].model;
      let lastErr: unknown;

      for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
        const current = modelsToTry[attempt];
        try {
          usedModel = current.model;
          const response = await withTimeout(
            ai.models.generateContent({
              model: current.model,
              contents: JSON.stringify(analystInput, null, 2),
              config: {
                systemInstruction,
                ...(current.useLowThinking
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    grade: {
                      type: Type.STRING,
                      description: 'One of A, B, C, or reject',
                    },
                    score: {
                      type: Type.INTEGER,
                      description: 'Setup quality score from 0 to 100',
                    },
                    bias_alignment: {
                      type: Type.STRING,
                      description: 'One of aligned, conflicting, or neutral',
                    },
                    confluences: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Short list of confirmed elements using only input data',
                    },
                    missing_elements: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Elements required for a higher grade that are absent',
                    },
                    risks: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Specific risks such as high-impact news, counter-trend, off-session, or low RR',
                    },
                    invalidation: {
                      type: Type.STRING,
                      description: 'The price level or condition from input that cancels this setup',
                    },
                    explanation_en: {
                      type: Type.STRING,
                      description: '2-3 sentences in English using only provided input levels',
                    },
                    explanation_km: {
                      type: Type.STRING,
                      description: '2-3 sentences in Khmer if language is km, or empty string if en',
                    },
                    disclaimer: {
                      type: Type.STRING,
                      description: 'Informational/educational disclaimer stating this is not financial advice',
                    },
                  },
                  required: [
                    'grade',
                    'score',
                    'bias_alignment',
                    'confluences',
                    'missing_elements',
                    'risks',
                    'invalidation',
                    'explanation_en',
                    'explanation_km',
                    'disclaimer',
                  ],
                },
              },
            }),
            current.timeoutMs,
            `Gemini (${current.model})`
          );

          const rawText = (response.text ?? '').trim();
          if (!rawText) {
            throw new Error(`Gemini (${current.model}) returned an empty response.`);
          }

          const cleanedJson = rawText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          const firstBrace = cleanedJson.indexOf('{');
          const lastBrace = cleanedJson.lastIndexOf('}');
          const jsonSlice =
            firstBrace !== -1 && lastBrace > firstBrace
              ? cleanedJson.slice(firstBrace, lastBrace + 1)
              : cleanedJson;

          parsed = JSON.parse(jsonSlice) as Record<string, unknown>;
          break;
        } catch (err) {
          lastErr = err;
          if (current.model === 'gemini-4-hydrogen' && isTransientGeminiError(err)) {
            hydrogenCooldownUntil = Date.now() + 60_000;
          }

          const msg = err instanceof Error ? err.message : String(err);
          const isRetryable =
            isTransientGeminiError(err) ||
            msg.includes('empty response') ||
            err instanceof SyntaxError;

          if (!isRetryable || attempt === modelsToTry.length - 1) {
            throw err;
          }

          const nextModel = modelsToTry[attempt + 1].model;
          const delayMs =
            nextModel !== current.model
              ? 150
              : Math.min(1800, 450 * Math.pow(2, attempt)) + Math.floor(Math.random() * 150);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      if (!parsed) {
        throw lastErr instanceof Error ? lastErr : new Error('Gemini request failed');
      }

      const rawGrade = String(parsed.grade ?? '');
      const normalizedGrade: AIAnalysisResult['grade'] =
        rawGrade === 'A' || rawGrade === 'B' || rawGrade === 'C' || rawGrade === 'reject'
          ? rawGrade
          : 'C';
      const rawBias = String(parsed.bias_alignment ?? '');
      const normalizedBiasAlignment: AIAnalysisResult['bias_alignment'] =
        rawBias === 'aligned' || rawBias === 'conflicting' || rawBias === 'neutral'
          ? rawBias
          : 'neutral';

      const explanationEn = String(parsed.explanation_en || parsed.explanation || '');
      const explanationKm =
        analystInput.language === 'km'
          ? String(parsed.explanation_km || parsed.khmer_summary || '')
          : '';
      const disclaimer = String(
        parsed.disclaimer ||
          'This analysis is for informational and educational purposes only and does not constitute financial advice.'
      );

      const result: AIAnalysisResult = {
        grade: normalizedGrade,
        score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
        bias_alignment: normalizedBiasAlignment,
        confluences: Array.isArray(parsed.confluences)
          ? parsed.confluences.map(String)
          : [],
        missing_elements: Array.isArray(parsed.missing_elements)
          ? parsed.missing_elements.map(String)
          : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
        invalidation: String(
          parsed.invalidation || `Close beyond stop loss ${setup.stop_loss}`
        ),
        explanation_en: explanationEn,
        explanation_km: explanationKm,
        disclaimer,
        explanation: analystInput.language === 'km' && explanationKm ? explanationKm : explanationEn,
        khmer_summary: explanationKm || undefined,
        model: usedModel,
        analyzedAt: new Date().toISOString(),
      };

      res.json(result);
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Gemini AI analysis failed';
      try {
        const parsedErr = JSON.parse(message);
        if (parsedErr?.error?.message) {
          message = parsedErr.error.message;
        }
      } catch {
        // Keep plain message
      }
      console.error('[analyze-setup] Error:', message);
      const lower = message.toLowerCase();
      const statusCode =
        lower.includes('api_key_invalid') || lower.includes('permission_denied')
          ? 403
          : lower.includes('429') || lower.includes('resource_exhausted')
          ? 429
          : 503;
      res.status(statusCode).json({ error: message });
    }
  });

  app.get('/api/signals', (_req, res) => {
    res.json({ signals: readSignals() });
  });

  app.post('/api/signals', (req, res) => {
    const signal = req.body as PersistedSignal;
    if (!signal || !signal.id || !signal.symbol) {
      res.status(400).json({ error: 'Invalid signal payload.' });
      return;
    }

    const existing = readSignals();
    const deduped = existing.filter((s) => s.id !== signal.id);
    const updated = [signal, ...deduped].slice(0, 100);
    writeSignals(updated);
    res.status(201).json({ signal, signals: updated });
  });

  app.patch('/api/signals/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body as { status?: PersistedSignal['status'] };
    if (!status || !['Active', 'TP Hit', 'SL Hit', 'Closed'].includes(status)) {
      res.status(400).json({ error: 'Invalid signal status.' });
      return;
    }

    const existing = readSignals();
    const updated = existing.map((s) => (s.id === id ? { ...s, status } : s));
    writeSignals(updated);
    res.json({ signals: updated });
  });

  app.delete('/api/signals/:id', (req, res) => {
    const { id } = req.params;
    const existing = readSignals();
    const updated = existing.filter((s) => s.id !== id);
    writeSignals(updated);
    res.json({ signals: updated });
  });

  app.post('/api/alerts/send', async (req, res) => {
    const { webhookUrl, telegramBotToken, telegramChatId, messageText, payload } =
      req.body as {
        webhookUrl?: string;
        telegramBotToken?: string;
        telegramChatId?: string;
        messageText?: string;
        payload?: unknown;
      };

    try {
      if (telegramBotToken && telegramChatId) {
        const tgUrl = `https://api.telegram.org/bot${encodeURIComponent(
          telegramBotToken.trim()
        )}/sendMessage`;
        const tgRes = await fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId.trim(),
            text: messageText || 'StructureDesk ICT Signal Alert',
          }),
        });
        const tgData = await tgRes.json();
        if (!tgRes.ok) {
          res.status(400).json({
            error: tgData?.description || `Telegram API returned ${tgRes.status}`,
          });
          return;
        }
        res.json({ ok: true, channel: 'telegram' });
        return;
      }

      if (webhookUrl) {
        if (!isSafeHttpsWebhook(webhookUrl)) {
          res.status(400).json({
            error: 'Webhook URL must be a public HTTPS URL.',
          });
          return;
        }
        const hookRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: messageText,
            text: messageText,
            signal: payload,
          }),
        });
        if (!hookRes.ok) {
          res.status(400).json({
            error: `Webhook endpoint returned HTTP ${hookRes.status}`,
          });
          return;
        }
        res.json({ ok: true, channel: 'webhook' });
        return;
      }

      res.status(400).json({
        error: 'Provide either an HTTPS Webhook URL or Telegram Bot Token + Chat ID.',
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to deliver alert.',
      });
    }
  });

  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const isCompiledServer = currentFile.endsWith('server.js');
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.RAILWAY_PUBLIC_DOMAIN) ||
    isCompiledServer;

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const cwdDist = path.resolve(process.cwd(), 'dist');
    const distDir = fs.existsSync(path.join(cwdDist, 'index.html'))
      ? cwdDist
      : path.resolve(currentDir, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`StructureDesk server listening on port ${PORT} (prod=${isProduction})`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
