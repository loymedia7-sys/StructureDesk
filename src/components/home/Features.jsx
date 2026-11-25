import React from "react";

export default function Features() {
  return (
    <section id="features" className="features-section">
      <div className="features-grid">
        <div className="features-header">
          <span className="hero-badge">AI-POWERED ADVANTAGE</span>
          <h2 className="features-title">
            Smarter Analysis.<br />
            <span className="hero-title-gradient">Better Decisions.</span>
          </h2>
          <p className="features-desc">
            Our rules engine detects ICT and Smart Money structure in real time while the advanced AI grades each setup with precision.
          </p>
        </div>

        <div className="features-cards-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <h3>Structure Detection</h3>
            <p>BOS, CHoCH, and institutional market structure shifts tracked instantly.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>
            </div>
            <h3>Liquidity Sweeps</h3>
            <p>Alerts when price takes buy-side or sell-side liquidity at key levels.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h3>AI Grading</h3>
            <p>Every setup scored from A to Reject with clear confluence explanations.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3>Risk Management</h3>
            <p>Automated position size, stop loss, and RR check on every trade setup.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
