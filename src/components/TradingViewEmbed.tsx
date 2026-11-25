import React, { useEffect, useRef } from 'react';
import type { MarketSymbol, Timeframe } from '../ict/types';

interface TradingViewEmbedProps {
  symbol: MarketSymbol;
  timeframe: Timeframe;
}

function mapToTradingViewSymbol(symbol: MarketSymbol): string {
  switch (symbol) {
    case 'XAUUSD':
      return 'OANDA:XAUUSD';
    case 'EURUSD':
      return 'OANDA:EURUSD';
    case 'GBPUSD':
      return 'OANDA:GBPUSD';
    case 'USDJPY':
      return 'OANDA:USDJPY';
    case 'BTCUSDT':
      return 'BINANCE:BTCUSDT';
  }
}

function mapToTradingViewInterval(tf: Timeframe): string {
  switch (tf) {
    case '1m':
      return '1';
    case '5m':
      return '5';
    case '15m':
      return '15';
    case '1H':
      return '60';
    case '4H':
      return '240';
    case '1D':
      return 'D';
  }
}

export const TradingViewEmbed: React.FC<TradingViewEmbedProps> = ({
  symbol,
  timeframe,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';
    const widgetHost = document.createElement('div');
    widgetHost.className = 'tradingview-widget-container__widget h-full w-full';
    container.appendChild(widgetHost);

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: mapToTradingViewSymbol(symbol),
      interval: mapToTradingViewInterval(timeframe),
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(11, 17, 32, 1)',
      gridColor: 'rgba(30, 41, 59, 0.45)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [symbol, timeframe]);

  return (
    <div className="relative h-[460px] w-full overflow-hidden rounded-md border border-slate-800 bg-[#0B1120]">
      <div
        ref={containerRef}
        className="tradingview-widget-container h-full w-full"
        data-testid="tradingview-embed"
      />
      <div className="border-t border-slate-800 bg-[#0F172A] px-3 py-1.5 text-xs text-slate-400 flex items-center justify-between">
        <span>TradingView display widget (for visual broker comparison only)</span>
        <span className="font-mono text-slate-300">
          {mapToTradingViewSymbol(symbol)} · {timeframe}
        </span>
      </div>
    </div>
  );
};
