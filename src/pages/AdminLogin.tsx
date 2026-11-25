import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ADMIN_EMAIL } from "../lib/firebase";
import { Lock, Mail, Shield } from "lucide-react";

export const AdminLogin: React.FC = () => {
  const { loginWithEmail } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
      setError("Unauthorized email. Only the administrator account can sign in here.");
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
      navigate("/admin");
    } catch (err: any) {
      setError("Invalid admin credentials or password. Please verify.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0F172A]/90 p-8 shadow-2xl backdrop-blur-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-100">
            Admin Dashboard Login
          </h1>
          <p className="text-xs text-slate-400">
            Restricted access for administrator ({ADMIN_EMAIL}).
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-4 pt-1">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-300">Admin Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jirouvu07@gmail.com"
                required
                className="w-full rounded-xl border border-slate-700 bg-[#0B1120] pl-9 pr-3 py-2 text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full rounded-xl border border-slate-700 bg-[#0B1120] pl-9 pr-3 py-2 text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-60 shadow-lg shadow-amber-500/20"
          >
            Access Admin Command Center
          </button>
        </form>
      </div>
    </div>
  );
};
