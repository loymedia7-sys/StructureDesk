import React from "react";
import { Link } from "react-router-dom";
import HeroChart from "./HeroChart";

export default function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-grid">
        <div className="hero-content">
          <div className="hero-badge">AI POWERED TRADING PLATFORM</div>
          <h1 className="hero-title">
            Trade Smarter.<br />
            <span className="hero-title-gradient">Trade with Confidence.</span>
          </h1>
          <p className="hero-description">
            AI-driven market analysis using ICT and Smart Money concepts. Real-time setups, graded by AI, explained in English and Khmer.
          </p>
          <div className="hero-buttons">
            <Link to="/login" className="btn-primary-green">
              Get Started Free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
            <a href="#features" className="btn-secondary-outline">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Watch Demo
            </a>
          </div>
          <div className="social-proof">
            <div className="avatar-group">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop" alt="Trader" />
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop" alt="Trader" />
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop" alt="Trader" />
              <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop" alt="Trader" />
              <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop" alt="Trader" />
            </div>
            <div>
              <div className="rating">4.9/5 ★★★★</div>
              <p className="proof-text">From beta traders</p>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <HeroChart />
        </div>
      </div>
    </section>
  );
}
