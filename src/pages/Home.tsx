import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Bot,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Bell,
  Cpu,
  Activity,
  Play,
  CheckCircle2,
  Shield,
  Zap,
  BarChart3,
  Globe,
} from 'lucide-react';

export const Home: React.FC = () => {
  const { loading } = useAuth();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050807] text-[#16D66B]">
        <div className="animate-pulse font-mono text-sm">Loading StructureDesk...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050807] text-white overflow-x-hidden font-sans selection:bg-[#16D66B] selection:text-[#050807]">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#16D66B]/15 blur-[160px] pointer-events-none rounded-full" />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Left Column: Headline & CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 space-y-8 text-left"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-[#16D66B]/40 bg-[#16D66B]/10 px-4 py-1.5 text-xs font-mono font-semibold text-[#16D66B] backdrop-blur-md shadow-[0_0_20px_rgba(22,214,107,0.15)]"
            >
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-[#16D66B]" />
              AI POWERED TRADING PLATFORM
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08]"
            >
              Trade Smarter.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#16D66B] via-emerald-400 to-teal-300 drop-shadow-[0_0_35px_rgba(22,214,107,0.3)]">
                Profit Consistently.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.7 }}
              className="text-base sm:text-lg text-[#8B9990] leading-relaxed max-w-2xl font-light"
            >
              AI-powered market intelligence, advanced ICT analytics, and intelligent trading tools designed to give institutional and retail traders an unbeatable edge.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="flex flex-wrap items-center gap-4 pt-2"
            >
              <Link
                to="/login"
                className="group flex items-center gap-2.5 rounded-xl bg-[#16D66B] px-8 py-4 text-sm font-bold text-[#050807] hover:bg-emerald-400 shadow-xl shadow-[#16D66B]/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/about"
                className="flex items-center gap-2 rounded-xl border border-emerald-900/50 bg-[#101813] px-7 py-4 text-sm font-semibold text-white hover:bg-emerald-950/40 hover:border-[#16D66B]/50 backdrop-blur-md transition-all"
              >
                <Play className="h-4 w-4 text-[#16D66B]" />
                <span>Watch Demo</span>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.7 }}
              className="flex items-center gap-6 pt-6 text-xs text-[#8B9990] border-t border-emerald-900/30"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#16D66B] animate-ping" />
                <span className="font-mono font-medium text-white">Live BBO Stream</span>
              </div>
              <div className="text-emerald-900">|</div>
              <div>
                <span className="font-semibold text-white">XAUUSD, EURUSD, BTCUSDT</span> &amp; more
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column: 3D Interactive Trading Visualization */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setMousePos({ x: 0, y: 0 })}
            style={{
              transform: `perspective(1000px) rotateY(${mousePos.x * 12}deg) rotateX(${ -mousePos.y * 12 }deg)`,
              transition: 'transform 0.1s ease-out',
            }}
            className="lg:col-span-5 relative cursor-pointer"
          >
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#16D66B]/30 to-teal-500/30 blur-xl opacity-70 group-hover:opacity-100 transition duration-1000" />
            
            <div className="relative rounded-2xl border border-[#16D66B]/40 bg-[#101813]/95 p-6 shadow-2xl backdrop-blur-2xl space-y-5">
              <div className="absolute -top-3 -right-3 rounded-full bg-[#16D66B] text-[#050807] px-3.5 py-1 text-[10px] font-mono font-bold shadow-lg animate-pulse">
                AI PREDICTION LIVE
              </div>

              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-4">
                <span className="font-mono text-xs text-[#16D66B] flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#16D66B] animate-ping" />
                  XAUUSD · 5m Institutional Order Block
                </span>
                <span className="rounded bg-[#16D66B]/10 px-2.5 py-1 text-[10px] font-mono text-[#16D66B] border border-[#16D66B]/30 font-semibold">
                  +23.45% Projected
                </span>
              </div>

              {/* Animated Candlestick Chart Preview */}
              <div className="h-48 rounded-xl bg-gradient-to-tr from-emerald-950/40 via-[#050807] to-[#101813] p-4 flex flex-col justify-end border border-emerald-900/50 relative overflow-hidden shadow-inner">
                <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
                  <TrendingUp className="h-40 w-40 text-[#16D66B]" />
                </div>
                
                <div className="flex items-end gap-1.5 h-36 z-10">
                  {[35, 50, 42, 68, 60, 85, 75, 95, 90, 115].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: 0.4 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                      style={{ height: `${h}%` }}
                      className={`flex-1 rounded-t transition-all ${
                        i >= 7 ? 'bg-[#16D66B] shadow-[0_0_20px_rgba(22,214,107,0.7)]' : 'bg-emerald-800/70'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Floating AI Card */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                className="flex items-center justify-between rounded-xl bg-[#050807] p-4 border border-emerald-900/40 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-[#16D66B]/15 flex items-center justify-center text-[#16D66B] border border-[#16D66B]/30">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Gemini AI Setup Grader</p>
                    <p className="text-[10px] text-[#8B9990]">Instant FVG &amp; OTE Confluence</p>
                  </div>
                </div>
                <span className="font-mono text-xs text-[#16D66B] font-extrabold bg-[#16D66B]/10 px-2.5 py-1 rounded-lg border border-[#16D66B]/30">
                  Grade A+
                </span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Market Ticker Section */}
      <section className="border-y border-emerald-900/30 bg-[#0A100D] py-4 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { symbol: 'XAUUSD', price: '$2,638.50', change: '+1.45%', up: true },
            { symbol: 'EURUSD', price: '1.0892', change: '+0.32%', up: true },
            { symbol: 'GBPUSD', price: '1.3045', change: '+0.45%', up: true },
            { symbol: 'USDJPY', price: '154.20', change: '-0.18%', up: false },
            { symbol: 'BTCUSDT', price: '$94,250', change: '+3.12%', up: true },
          ].map((item, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.03, borderColor: '#16D66B' }}
              className="flex items-center justify-between p-3.5 rounded-xl bg-[#101813] border border-emerald-900/30 transition-all shadow-md cursor-pointer"
            >
              <span className="font-mono text-xs font-bold text-white">{item.symbol}</span>
              <div className="text-right">
                <span className="font-mono text-xs text-white block">{item.price}</span>
                <span className={`font-mono text-[10px] font-bold ${item.up ? 'text-[#16D66B]' : 'text-rose-400'}`}>
                  {item.change}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="text-xs font-mono font-semibold text-[#16D66B] uppercase tracking-widest">
            AI-POWERED ADVANTAGE
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Smarter Technology. <span className="text-[#16D66B]">Better Trading.</span>
          </h2>
          <p className="text-[#8B9990] text-sm sm:text-base">
            Our proprietary AI analyzes millions of market data points in real-time to deliver actionable insights and high-probability trading setups.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Cpu, title: "AI Stock & Forex Analysis", desc: "Analyze market structures and identify potential trading setups using deep learning models." },
            { icon: Bell, title: "Smart Alerts", desc: "Receive real-time notifications for market movements, liquidity sweeps, breakouts, and trading sessions." },
            { icon: ShieldCheck, title: "Risk Management", desc: "Calculate position sizes, stop losses, risk percentages, and reward ratios automatically." },
            { icon: TrendingUp, title: "Automated Trading Tools", desc: "Use existing supported strategies and institutional webhooks for seamless execution." },
          ].map((feat, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -6, borderColor: 'rgba(22,214,107,0.6)' }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-7 space-y-4 shadow-xl relative group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#16D66B]/5 rounded-full blur-2xl group-hover:bg-[#16D66B]/10 transition-all" />
              <div className="h-12 w-12 rounded-xl bg-[#16D66B]/10 flex items-center justify-center text-[#16D66B] border border-[#16D66B]/30 group-hover:scale-110 transition-transform">
                <feat.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-base font-bold text-white">{feat.title}</h3>
              <p className="text-xs text-[#8B9990] leading-relaxed">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-[#0A100D] border-y border-emerald-900/30 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-mono font-semibold text-[#16D66B] uppercase tracking-widest">HOW IT WORKS</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">Three Steps to Institutional Edge</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Connect to StructureDesk", desc: "Sign in with Google securely and access the professional multi-timeframe trading workspace." },
              { step: "02", title: "Analyze Market Opportunities", desc: "Select currency pairs or crypto assets and let Gemini AI grade ICT FVG and Order Block setups." },
              { step: "03", title: "Manage Your Trading Risk", desc: "Calculate precise lot sizing, risk-to-reward parameters, and track your active signals." },
            ].map((s, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -4 }}
                className="rounded-2xl border border-emerald-900/30 bg-[#101813] p-8 space-y-4 shadow-xl"
              >
                <span className="font-mono text-3xl font-extrabold text-[#16D66B]">{s.step}</span>
                <h3 className="font-display text-lg font-bold text-white">{s.title}</h3>
                <p className="text-xs text-[#8B9990] leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-28 text-center max-w-4xl mx-auto px-4 space-y-8 relative">
        <div className="absolute inset-0 bg-[#16D66B]/5 blur-[120px] pointer-events-none rounded-full" />
        <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-white relative z-10">
          Ready to Trade Smarter?
        </h2>
        <p className="text-sm sm:text-base text-[#8B9990] max-w-xl mx-auto relative z-10">
          Discover a smarter way to analyze markets and manage trading opportunities with StructureDesk AI.
        </p>
        <div className="pt-4 relative z-10">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-[#16D66B] px-9 py-4 text-sm font-bold text-[#050807] hover:bg-emerald-400 shadow-2xl shadow-[#16D66B]/30 transition-all hover:scale-105 active:scale-95"
          >
            <span>Get Started Free</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};
