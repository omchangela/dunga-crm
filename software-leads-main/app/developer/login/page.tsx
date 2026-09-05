"use client";

import { useState } from "react";
import { useDeveloperAuth } from "@/contexts/DeveloperAuthContext";

export default function DeveloperLoginPage() {
  const { login } = useDeveloperAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || loading) return;
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.toLowerCase().includes("inactive") || msg.toLowerCase().includes("inactive"))
        setError("Your account is inactive. Contact admin.");
      else if (msg.toLowerCase().includes("not activated") || msg.toLowerCase().includes("password"))
        setError("Account not activated. Contact admin.");
      else
        setError("Email or password incorrect.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f6fa] px-4">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <div className="mx-auto flex h-28 w-full items-center justify-center py-2 px-4">
            <img src="/dunga_logo.png" alt="Dunga Technologies Logo" className="h-24 max-w-full object-contain" />
          </div>
        </div>

        <div className="rounded-2xl border border-[#e5e9f2] bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" required autoComplete="email"
                className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-700 placeholder:text-[#b0bac9] focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password"
                className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-700 placeholder:text-[#b0bac9] focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !email || !password}
              className="h-10 w-full rounded-lg bg-teal-600 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-[#8094ae]">
          Forgot password? Contact your admin.
        </p>
      </div>
    </div>
  );
}
