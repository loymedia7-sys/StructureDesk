import React from "react";
import { Link } from "react-router-dom";

export default function CtaFooter() {
  return (
    <footer className="footer-wrapper">
      <div className="cta-card">
        <h3>Start your free beta today.</h3>
        <p>Join thousands of traders using ICT and Smart Money concepts powered by AI.</p>
        <Link to="/login" className="btn-primary-green">
          Get Started Free
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </Link>
      </div>
      <div className="footer-bottom">
        <p>© 2026 SMC Signal AI. Educational analysis, not financial advice. Trading involves significant risk.</p>
      </div>
    </footer>
  );
}
