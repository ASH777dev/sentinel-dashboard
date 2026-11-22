"use client";

import { useState } from "react";
import { KeyRound, Play, Zap } from "lucide-react";
import type { IssuedApiKey } from "@/types/telemetry";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export function TrafficSimulator() {
  const [tier, setTier] = useState<"free" | "pro">("free");
  const [activeKey, setActiveKey] = useState<IssuedApiKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const mintKey = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `web-sim-${tier}`, tier }),
      });
      if (!res.ok) throw new Error(`Key creation failed (${res.status})`);
      const data: IssuedApiKey = await res.json();
      setActiveKey(data);
      setFeedback(`Issued ${data.tier.toUpperCase()} key (limit: ${data.rate_limit} req / ${data.window_seconds}s)`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed to mint API key.");
    } finally {
      setBusy(false);
    }
  };

  const fireRequests = async (count: number) => {
    if (!activeKey) return;
    setBusy(true);
    setFeedback(`Firing ${count} request${count > 1 ? "s" : ""}...`);
    let ok = 0;
    let blocked = 0;

    try {
      for (let i = 0; i < count; i++) {
        const res = await fetch(`${API_URL}/api/v1/resource`, {
          headers: { "X-API-Key": activeKey.api_key },
        });
        if (res.status === 200) ok += 1;
        else if (res.status === 429) blocked += 1;
      }
      setFeedback(`Completed: ${ok} allowed (200 OK), ${blocked} rate-limited (429).`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Request burst failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
            Live Traffic Simulator
          </h2>
          <p className="text-xs text-zinc-400">
            Mint an API key and fire bursts directly against the deployed Sentinel API.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as "free" | "pro")}
            disabled={busy}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="free">Free Tier (5 req/min)</option>
            <option value="pro">Pro Tier (20 req/min)</option>
          </select>

          <button
            onClick={mintKey}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-300 disabled:opacity-50"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Mint Key
          </button>

          <button
            onClick={() => fireRequests(1)}
            disabled={busy || !activeKey}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" />
            Send 1 Req
          </button>

          <button
            onClick={() => fireRequests(9)}
            disabled={busy || !activeKey}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40"
          >
            <Zap className="h-3.5 w-3.5" />
            Trigger 9x Burst
          </button>
        </div>
      </div>

      {(activeKey || feedback) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-xs">
          <span className="font-mono text-zinc-300">
            {activeKey ? `Active Key: ${activeKey.api_key.slice(0, 18)}... (${activeKey.tier})` : "No active key"}
          </span>
          {feedback && <span className="text-emerald-400">{feedback}</span>}
        </div>
      )}
    </section>
  );
}