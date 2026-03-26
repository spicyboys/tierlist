"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function ResetPasswordPage() {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { success: boolean; resetToken?: string };
      if (data.success) {
        if (data.resetToken) {
          // Dev mode: auto-fill the token
          setToken(data.resetToken);
        }
        setStep("reset");
        toast.success("Enter your reset token to set a new password");
      }
    } catch {
      toast.error("Failed to request reset");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        toast.success("Password reset! You can now log in.");
        window.location.href = "/auth/login";
      } else {
        const data = (await res.json()) as { error: string };
        toast.error(data.error || "Reset failed");
      }
    } catch {
      toast.error("Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-4 py-3">
        <Link href="/" className="text-lg font-bold">
          TierMaker
        </Link>
      </nav>
      <div className="max-w-sm mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-6 text-center">Reset Password</h1>

        {step === "request" ? (
          <form onSubmit={handleRequestReset} className="bg-gray-900 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-medium transition"
            >
              {loading ? "Sending..." : "Request Reset"}
            </button>
            <p className="text-center text-sm text-gray-400">
              <Link href="/auth/login" className="text-blue-400 hover:underline">
                Back to login
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="bg-gray-900 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Reset Token</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-blue-500 outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-medium transition"
            >
              {loading ? "Resetting..." : "Set New Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
