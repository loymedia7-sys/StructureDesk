import React from "react";

export default function HeroChart() {
  return (
    <div className="hero-chart-container">
      <div className="floating-card float-card-1">
        <span className="dot green"></span>
        <div>
          <strong>AI Grade: A</strong>
          <small>Score 86</small>
        </div>
      </div>

      <div className="floating-card float-card-2">
        <span className="dot green"></span>
        <div>
          <strong>BOS Confirmed</strong>
          <small>OTE Discount 71%</small>
        </div>
      </div>

      <div className="chart-platform">
        <svg viewBox="0 0 400 280" className="chart-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1="40" y1="40" x2="360" y2="40" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1="40" y1="100" x2="360" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1="40" y1="160" x2="360" y2="160" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1="40" y1="220" x2="360" y2="220" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />

          {/* Candlesticks */}
          <g className="candlesticks">
            <line x1="70" y1="150" x2="70" y2="200" stroke="#22c55e" strokeWidth="2" />
            <rect x="62" y="160" width="16" height="30" rx="3" fill="#22c55e" />

            <line x1="110" y1="130" x2="110" y2="190" stroke="#22c55e" strokeWidth="2" />
            <rect x="102" y="140" width="16" height="35" rx="3" fill="#22c55e" />

            <line x1="150" y1="110" x2="150" y2="170" stroke="#ef4444" strokeWidth="2" />
            <rect x="142" y="120" width="16" height="25" rx="3" fill="#ef4444" />

            <line x1="190" y1="90" x2="190" y2="150" stroke="#22c55e" strokeWidth="2" />
            <rect x="182" y="100" width="16" height="40" rx="3" fill="#22c55e" />

            <line x1="230" y1="75" x2="230" y2="135" stroke="#22c55e" strokeWidth="2" />
            <rect x="222" y="85" width="16" height="30" rx="3" fill="#22c55e" />

            <line x1="270" y1="50" x2="270" y2="110" stroke="#22c55e" strokeWidth="2" />
            <rect x="262" y="60" width="16" height="35" rx="3" fill="#22c55e" />

            <line x1="310" y1="35" x2="310" y2="95" stroke="#22c55e" strokeWidth="2" />
            <rect x="302" y="45" width="16" height="38" rx="3" fill="#22c55e" />
          </g>

          {/* Area & Trend line */}
          <path
            d="M 70 175 L 110 155 L 150 135 L 190 120 L 230 100 L 270 75 L 310 50 L 310 240 L 70 240 Z"
            fill="url(#greenGrad)"
          />
          <path
            d="M 70 175 L 110 155 L 150 135 L 190 120 L 230 100 L 270 75 L 310 50"
            stroke="#4ade80"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#glow)"
          />
        </svg>
      </div>
    </div>
  );
}
