"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, User } from "lucide-react";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("owner@examdesk.local");
  const [password, setPassword] = useState("Admin@12345");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      localStorage.setItem("examdesk.token", data.token);
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fb] px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-teal-900/20">
            E
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900 tracking-tight">
            ExamDesk Library OS
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Manage your competitive exam reading room securely.
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div className="relative">
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Email or mobile</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition-all shadow-sm"
                  placeholder="Enter email or mobile"
                />
              </div>
            </div>
            
            <div className="relative">
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Password</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition-all shadow-sm"
                  placeholder="Enter password"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-rose-500 text-sm font-medium bg-rose-50 p-3 rounded-lg border border-rose-100 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-primary hover:bg-primary-strong focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all shadow-lg shadow-teal-900/20 disabled:opacity-50"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              <Shield className="h-5 w-5 text-teal-400 group-hover:text-teal-300" />
            </span>
            {loading ? "Signing in..." : "Sign in securely"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Local demo access</span>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 font-medium">Owner:</span>
              <span className="text-slate-400">owner@examdesk.local / Admin@12345</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 font-medium">Student:</span>
              <span className="text-slate-400">aarav@examdesk.local / Student@123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
