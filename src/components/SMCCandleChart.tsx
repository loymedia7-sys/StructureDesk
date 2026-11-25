import React, { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { getSymbolContractSpec } from '../ict/risk';
import type {
  Candle,
  ICTEngineAnalysis,
  MarketSymbol,
  StructuredSetupPayload,
} from '../ict/types';

export interface OverlayVisibility {
  fvg: boolean;
  orderBlocks: boolean;
  structure: boolean;
  liquidity: boolean;
  dealingRange: boolean;
}

interface SMCCandleChartProps {
  symbol: MarketSymbol;
  candles: Candle[];
  formingCandle?: Candle | null;
  liveQuote?: { bid: number; ask: number } | null;
  isLiveStream?: boolean;
  lastTickTime?: number | null;
  analysis: ICTEngineAnalysis;
  setup: StructuredSetupPayload | null;
  overlays: OverlayVisibility;
}

export const SMCCandleChart: React.FC<SMCCandleChartProps> = ({
  symbol,
  candles,
  formingCandle = null,
  liveQuote = null,
  isLiveStream = false,
  lastTickTime = null,
  analysis,
  setup,
  overlays,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const spec = getSymbolContractSpec(symbol);
  const latest = formingCandle ?? candles[candles.length - 1];
  const [hoverCandle, setHoverCandle] = useState<Candle | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 460,
      layout: {
        background: { type: ColorType.Solid, color: '#0B1120' },
        textColor: '#94A3B8',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.45)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.45)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(148, 163, 184, 0.4)', labelBackgroundColor: '#1E293B' },
        horzLine: { color: 'rgba(148, 163, 184, 0.4)', labelBackgroundColor: '#1E293B' },
      },
      rightPriceScale: {
        borderColor: 'rgba(30, 41, 59, 0.8)',
      },
      timeScale: {
        borderColor: 'rgba(30, 41, 59, 0.8)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
      priceFormat: {
        type: 'price',
        precision: spec.decimals,
        minMove: Math.pow(10, -spec.decimals),
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) {
          try {
            chart.applyOptions({ width: w });
          } catch {
            // Ignore if chart disposed mid-frame
          }
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      chartRef.current = null;
      seriesRef.current = null;
      setTimeout(() => {
        try {
          chart.remove();
        } catch {
          // Ignore already-disposed instance
        }
      }, 0);
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    try {
      series.applyOptions({
        priceFormat: {
          type: 'price',
          precision: spec.decimals,
          minMove: Math.pow(10, -spec.decimals),
        },
      });
    } catch {
      // Ignore if chart is disposed
    }
  }, [spec.decimals]);

  // Update candles, price lines, crosshair, and synchronized SMC canvas overlay
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const canvas = canvasRef.current;
    if (!chart || !series || !canvas) return;

    let effectActive = true;
    let rafId = 0;

    const formatted = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    if (
      formingCandle &&
      (candles.length === 0 || formingCandle.time >= candles[candles.length - 1].time)
    ) {
      formatted.push({
        time: formingCandle.time as UTCTimestamp,
        open: formingCandle.open,
        high: formingCandle.high,
        low: formingCandle.low,
        close: formingCandle.close,
      });
    }
    series.setData(formatted);
    chart.timeScale().fitContent();

    const priceLines: ReturnType<typeof series.createPriceLine>[] = [];
    if (setup) {
      priceLines.push(
        series.createPriceLine({
          price: setup.entry_price,
          color: '#38BDF8',
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title: 'ENTRY',
        }),
        series.createPriceLine({
          price: setup.stop_loss,
          color: '#EF4444',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'SL',
        }),
        series.createPriceLine({
          price: setup.take_profit,
          color: '#10B981',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'TP',
        })
      );
    }

    if (overlays.dealingRange && analysis.dealingRange) {
      priceLines.push(
        series.createPriceLine({
          price: analysis.dealingRange.equilibrium,
          color: 'rgba(148, 163, 184, 0.55)',
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: 'EQ 50%',
        })
      );
    }

    const candleByTime = new Map<number, Candle>();
    for (const c of candles) {
      candleByTime.set(c.time, c);
    }

    const crosshairHandler = (param: { time?: unknown }) => {
      if (!effectActive) return;
      if (typeof param.time === 'number') {
        setHoverCandle(candleByTime.get(param.time) ?? null);
      } else {
        setHoverCandle(null);
      }
    };
    chart.subscribeCrosshairMove(crosshairHandler);

    const drawOverlay = () => {
      if (!effectActive) return;
      const container = containerRef.current;
      if (!container) return;
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = 460;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const timeScale = chart.timeScale();
      const rightEdgeX = width - 72;
      const lastTime = candles[candles.length - 1]?.time;
      const lastX = lastTime
        ? timeScale.timeToCoordinate(lastTime as UTCTimestamp) ?? rightEdgeX
        : rightEdgeX;

      // 1. OTE Zone Band (62%-79%)
      if (overlays.dealingRange && analysis.dealingRange) {
        const dr = analysis.dealingRange;
        const oteTop =
          setup?.direction === 'short' ? dr.oteBearishTop : dr.oteBullishTop;
        const oteBot =
          setup?.direction === 'short'
            ? dr.oteBearishBottom
            : dr.oteBullishBottom;
        const y1 = series.priceToCoordinate(oteTop);
        const y2 = series.priceToCoordinate(oteBot);
        if (y1 !== null && y2 !== null) {
          const topY = Math.min(y1, y2);
          const boxH = Math.max(2, Math.abs(y2 - y1));
          ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
          ctx.fillRect(0, topY, rightEdgeX, boxH);
          ctx.fillStyle = 'rgba(245, 158, 11, 0.78)';
          ctx.font = '500 10px "JetBrains Mono", monospace';
          ctx.fillText('OTE 62-79%', 10, topY + 11);
        }
      }

      // 2. Fair Value Gaps (recent 5)
      if (overlays.fvg) {
        const visibleFvgs = analysis.fvgs.slice(-5);
        for (const fvg of visibleFvgs) {
          const x1 = timeScale.timeToCoordinate(fvg.startTime as UTCTimestamp);
          const x2Raw = timeScale.timeToCoordinate(fvg.endTime as UTCTimestamp);
          const yTop = series.priceToCoordinate(fvg.top);
          const yBot = series.priceToCoordinate(fvg.bottom);
          if (x1 === null || yTop === null || yBot === null) continue;
          const x2 = x2Raw !== null ? Math.max(x1 + 24, x2Raw) : Math.max(x1 + 24, lastX);
          const topY = Math.min(yTop, yBot);
          const boxH = Math.max(3, Math.abs(yBot - yTop));

          const isBull = fvg.type === 'bullish';
          const alpha = fvg.mitigated ? 0.07 : 0.2;
          ctx.fillStyle = isBull
            ? `rgba(16, 185, 129, ${alpha})`
            : `rgba(239, 68, 68, ${alpha})`;
          ctx.fillRect(x1, topY, x2 - x1, boxH);

          ctx.strokeStyle = isBull
            ? 'rgba(16, 185, 129, 0.45)'
            : 'rgba(239, 68, 68, 0.45)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x1, topY, x2 - x1, boxH);

          if (!fvg.mitigated) {
            ctx.fillStyle = isBull ? '#6EE7B7' : '#FCA5A5';
            ctx.font = '500 10px "JetBrains Mono", monospace';
            ctx.fillText('FVG', x1 + 4, topY + 11);
          }
        }
      }

      // 3. Order Blocks (recent 4)
      if (overlays.orderBlocks) {
        const visibleObs = analysis.orderBlocks.slice(-4);
        for (const ob of visibleObs) {
          const x1 = timeScale.timeToCoordinate(ob.time as UTCTimestamp);
          const yTop = series.priceToCoordinate(ob.top);
          const yBot = series.priceToCoordinate(ob.bottom);
          if (x1 === null || yTop === null || yBot === null) continue;
          const x2 = Math.min(rightEdgeX, Math.max(x1 + 45, lastX));
          const topY = Math.min(yTop, yBot);
          const boxH = Math.max(4, Math.abs(yBot - yTop));

          const isBull = ob.type === 'bullish';
          ctx.fillStyle = isBull
            ? 'rgba(56, 189, 248, 0.12)'
            : 'rgba(249, 115, 22, 0.12)';
          ctx.fillRect(x1, topY, x2 - x1, boxH);

          ctx.strokeStyle = isBull
            ? 'rgba(56, 189, 248, 0.5)'
            : 'rgba(249, 115, 22, 0.5)';
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(x1, topY, x2 - x1, boxH);
          ctx.setLineDash([]);

          ctx.fillStyle = isBull ? '#7DD3FC' : '#FDBA74';
          ctx.font = '500 10px "JetBrains Mono", monospace';
          ctx.fillText(`${isBull ? 'Bull' : 'Bear'} OB`, x1 + 4, topY + 11);
        }
      }

      // 4. BOS & CHoCH Structure Break Lines (recent 6)
      if (overlays.structure) {
        const recentEvents = analysis.structureEvents.slice(-6);
        for (const ev of recentEvents) {
          const originCandle = candles[ev.brokenSwingIndex];
          if (!originCandle) continue;
          const x1 = timeScale.timeToCoordinate(originCandle.time as UTCTimestamp);
          const x2 = timeScale.timeToCoordinate(ev.time as UTCTimestamp);
          const y = series.priceToCoordinate(ev.brokenPrice);
          if (x1 === null || x2 === null || y === null) continue;

          const color =
            ev.type === 'CHoCH'
              ? '#F59E0B'
              : ev.direction === 'bullish'
              ? '#10B981'
              : '#EF4444';

          ctx.strokeStyle = color;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.stroke();

          ctx.fillStyle = color;
          ctx.font = '600 10px "JetBrains Mono", monospace';
          const midX = (x1 + x2) / 2 - 14;
          ctx.fillText(ev.type, midX, ev.direction === 'bullish' ? y - 5 : y + 12);
        }
      }

      // 5. Liquidity Sweeps (recent 3 to avoid label collisions)
      if (overlays.liquidity) {
        const recentSweeps = analysis.sweeps.slice(-3);
        for (const sw of recentSweeps) {
          const x = timeScale.timeToCoordinate(sw.time as UTCTimestamp);
          const y = series.priceToCoordinate(sw.sweepExtreme);
          if (x === null || y === null) continue;

          const isSellSweep = sw.side === 'sell_side';
          ctx.fillStyle = isSellSweep ? '#10B981' : '#EF4444';
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = '500 10px "JetBrains Mono", monospace';
          const labelX = Math.min(rightEdgeX - 58, Math.max(6, x - 24));
          ctx.fillText(
            isSellSweep ? 'SSL Sweep' : 'BSL Sweep',
            labelX,
            isSellSweep ? y + 14 : y - 8
          );
        }
      }
    };

    rafId = requestAnimationFrame(drawOverlay);
    const rangeSub = () => {
      if (!effectActive) return;
      rafId = requestAnimationFrame(drawOverlay);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(rangeSub);

    return () => {
      effectActive = false;
      cancelAnimationFrame(rafId);
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeSub);
        chart.unsubscribeCrosshairMove(crosshairHandler);
        for (const pl of priceLines) {
          series.removePriceLine(pl);
        }
      } catch {
        // Ignore if chart already disposed
      }
    };
  }, [candles, analysis, setup, overlays]);

  // Smoothly update forming live candle without resetting zoom/pan or overlay fitContent
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !formingCandle) return;
    const lastClosed = candles[candles.length - 1];
    if (lastClosed && formingCandle.time < lastClosed.time) return;
    try {
      series.update({
        time: formingCandle.time as UTCTimestamp,
        open: formingCandle.open,
        high: formingCandle.high,
        low: formingCandle.low,
        close: formingCandle.close,
      });
    } catch {
      // Ignore if chart is re-initializing
    }
  }, [formingCandle, candles]);

  const activeBar = hoverCandle ?? latest;

  return (
    <div className="relative overflow-hidden rounded-md border border-slate-800 bg-[#0B1120]">
      {/* OHLC Readout Bar */}
      {activeBar && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-slate-800/80 bg-[#0F172A]/80 px-3 py-1.5 font-mono text-[11px] tabular-nums text-slate-300">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold text-slate-100">{symbol}</span>
            <span>
              O <span className="text-slate-200">{activeBar.open.toFixed(spec.decimals)}</span>
            </span>
            <span>
              H <span className="text-slate-200">{activeBar.high.toFixed(spec.decimals)}</span>
            </span>
            <span>
              L <span className="text-slate-200">{activeBar.low.toFixed(spec.decimals)}</span>
            </span>
            <span>
              C{' '}
              <span
                className={
                  activeBar.close >= activeBar.open
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }
              >
                {activeBar.close.toFixed(spec.decimals)}
              </span>
            </span>
            <span className="text-slate-400">
              UTC {new Date(activeBar.time * 1000).toISOString().slice(11, 16)}
            </span>
          </div>

          {isLiveStream && (
            <div className="flex items-center gap-2.5 text-[11px]">
              {liveQuote && (
                <span className="text-slate-400">
                  Bid {liveQuote.bid.toFixed(spec.decimals)} · Ask {liveQuote.ask.toFixed(spec.decimals)}
                </span>
              )}
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-semibold">LIVE STREAM</span>
              {lastTickTime && (
                <span className="text-slate-400">
                  {new Date(lastTickTime).toISOString().slice(11, 19)} UTC
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="relative h-[460px] w-full" data-testid="smc-chart-surface">
        <div ref={containerRef} className="h-full w-full" />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 z-10"
        />
      </div>
    </div>
  );
};
