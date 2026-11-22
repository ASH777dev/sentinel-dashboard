"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Gauge,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrafficSimulator } from "@/components/TrafficSimulator";
import { useSentinelStream } from "@/hooks/useSentinelStream";
import type { RequestLogItem } from "@/types/telemetry";

type StatusFilter = "all" | "allowed" | "blocked";

function formatTime(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "--:--:--"
    : date.toLocaleTimeString([], {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
}

function computeP95(items: RequestLogItem[]): number {
  if (items.length === 0) return 0;
  const sorted = items.map((item) => item.latency_ms).sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  );
  return Number(sorted[index].toFixed(1));
}

export default function DashboardPage() {
  const { stats, logs, alerts, status, isHydrating, error, refresh } =
    useSentinelStream();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [frozenLogs, setFrozenLogs] = useState<RequestLogItem[] | null>(null);

  const isPaused = frozenLogs !== null;
  const displayLogs = frozenLogs ?? logs;

  const filteredLogs = useMemo(() => {
    if (statusFilter === "allowed") {
      return displayLogs.filter((log) => log.allowed);
    }
    if (statusFilter === "blocked") {
      return displayLogs.filter((log) => !log.allowed);
    }
    return displayLogs;
  }, [displayLogs, statusFilter]);

  const p95Latency = useMemo(() => computeP95(logs), [logs]);

  const chartData = useMemo(
    () =>
      [...displayLogs]
        .slice(0, 25)
        .reverse()
        .map((log, index) => ({
          idx: index + 1,
          time: formatTime(log.timestamp),
          latency: log.latency_ms,
          status: log.status_code,
        })),
    [displayLogs]
  );

  const togglePause = () => {
    setFrozenLogs((prev) => (prev ? null : [...logs]));
  };

  const badgeStyle =
    status === "live"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
      : status === "offline"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
        : "border-amber-500/40 bg-amber-500/10 text-amber-300";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              SENTINEL <span className="text-zinc-500">/ TELEMETRY</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Real-time Redis Lua sliding-window rate limiting and anomaly stream
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase ${badgeStyle}`}
            >
              <Wifi className="h-3.5 w-3.5" />
              {status}
            </span>
            <button
              onClick={togglePause}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                isPaused
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
                  : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-zinc-600"
              }`}
            >
              {isPaused ? (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Resume Feed
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  Pause Feed
                </>
              )}
            </button>
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync DB
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            {error} — Render free-tier containers wake up in ~45s after inactivity.
          </div>
        )}

        {/* Simulator */}
        <TrafficSimulator />

        {/* KPI Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Requests"
            value={isHydrating ? "..." : stats.total_requests.toLocaleString()}
            sublabel="Persisted in Neon PostgreSQL"
            icon={<Activity className="h-4 w-4 text-zinc-400" />}
          />
          <KpiCard
            label="Blocked (429)"
            value={
              isHydrating
                ? "..."
                : `${stats.blocked_requests.toLocaleString()} (${stats.block_rate_percent}%)`
            }
            sublabel="Atomic Redis Lua rejections"
            icon={<ShieldAlert className="h-4 w-4 text-rose-400" />}
            accent="text-rose-400"
          />
          <KpiCard
            label="Avg / Rolling p95 Latency"
            value={
              isHydrating ? "..." : `${stats.avg_latency_ms} / ${p95Latency} ms`
            }
            sublabel="Redis cache-aside hot path"
            icon={<Gauge className="h-4 w-4 text-emerald-400" />}
          />
          <KpiCard
            label="Anomaly Alerts"
            value={isHydrating ? "..." : stats.total_alerts.toLocaleString()}
            sublabel="Deduplicated via SET NX EX 30"
            icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
            accent="text-amber-300"
          />
        </section>

        {/* Chart + Alerts */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                Live Request Latency (Last 25 Events)
              </h2>
              <span className="text-xs text-zinc-500">
                {isPaused ? "Snapshot paused" : "Streaming live (ms)"}
              </span>
            </div>
            <div className="h-64 w-full">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                  No traffic yet — mint a key above and trigger a burst.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                    <XAxis dataKey="time" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} unit="ms" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#09090b",
                        borderColor: "#27272a",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="latency"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#latencyGrad)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                Anomaly Alerts
              </h2>
              <span className="font-mono text-xs text-zinc-500">
                {alerts.length} recent
              </span>
            </div>
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <p className="text-xs text-zinc-500">No anomalies detected yet.</p>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-rose-300">
                        {alert.alert_type}
                      </span>
                      <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
                        {alert.severity}
                      </span>
                    </div>
                    <p className="mt-1.5 text-zinc-300">{alert.details}</p>
                    <p className="mt-1 font-mono text-[10px] text-zinc-500">
                      {formatTime(alert.timestamp)} • IP {alert.client_ip}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Live Request Feed with Filter Pills */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
              Live Request Stream
            </h2>
            <div className="flex items-center gap-1.5 text-xs">
              {(
                [
                  ["all", "All"],
                  ["allowed", "200 OK"],
                  ["blocked", "429 Blocked"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-md border px-2.5 py-1 font-medium transition ${
                    statusFilter === value
                      ? "border-zinc-400 bg-zinc-100 text-zinc-950"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Endpoint</th>
                  <th className="pb-2 pr-4">Key ID</th>
                  <th className="pb-2 pr-4">Client IP</th>
                  <th className="pb-2 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70 font-mono">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-zinc-500">
                      No matching events in the current buffer.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.slice(0, 20).map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-800/30">
                      <td className="py-2 pr-4 text-zinc-400">
                        {formatTime(log.timestamp)}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold ${
                            log.allowed
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-rose-500/15 text-rose-400"
                          }`}
                        >
                          {log.allowed ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <ShieldAlert className="h-3 w-3" />
                          )}
                          {log.status_code}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-zinc-200">{log.endpoint}</td>
                      <td className="py-2 pr-4 text-zinc-400">
                        #{log.api_key_id ?? "-"}
                      </td>
                      <td className="py-2 pr-4 text-zinc-400">{log.client_ip}</td>
                      <td className="py-2 text-right text-zinc-200">
                        {log.latency_ms} ms
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Architecture Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-900 pt-4 text-xs text-zinc-500">
          <span>
            Stack: Next.js App Router • TypeScript • Recharts • WebSocket Ring Buffer (cap 50)
          </span>
          <span>
            Backend: FastAPI • Upstash Redis Lua • Neon PostgreSQL
          </span>
        </footer>
      </div>
    </main>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  icon,
  accent = "text-white",
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        {icon}
      </div>
      <p className={`mt-2 font-mono text-2xl font-bold ${accent}`}>{value}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{sublabel}</p>
    </div>
  );
}