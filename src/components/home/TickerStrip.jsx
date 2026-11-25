import React from "react";
import { TICKER_DATA } from "../../lib/tickerData";

export default function TickerStrip() {
  return (
    <div className="ticker-wrapper">
      <div className="ticker-container">
        {TICKER_DATA.map((item, idx) => {
          const minVal = Math.min(...item.spark);
          const maxVal = Math.max(...item.spark);
          const range = maxVal - minVal || 1;
          const points = item.spark
            .map((val, i) => {
              const x = (i / (item.spark.length - 1)) * 90;
              const y = 30 - ((val - minVal) / range) * 24;
              return `${x},${y}`;
            })
            .join(" ");

          return (
            <div key={idx} className="ticker-card">
              <div className="ticker-top">
                <span className="ticker-symbol">{item.symbol}</span>
                <span className={`ticker-change ${item.isPositive ? "pos" : "neg"}`}>
                  {item.changePct}
                </span>
              </div>
              <div className="ticker-bottom">
                <span className="ticker-price">{item.price}</span>
                <svg className="ticker-spark" viewBox="0 0 90 30">
                  <polyline
                    fill="none"
                    stroke={item.isPositive ? "#22c55e" : "#ef4444"}
                    strokeWidth="2"
                    points={points}
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
