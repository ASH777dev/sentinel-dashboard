"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AnomalyAlertItem,
  ConnectionState,
  RequestLogItem,
  TrafficStats,
} from "@/types/telemetry";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000/ws/telemetry";
const MAX_BUFFER = 50;

const EMPTY_STATS: TrafficStats = {
  total_requests: 0,
  blocked_requests: 0,
  block_rate_percent: 0,
  avg_latency_ms: 0,
  total_alerts: 0,
  active_ws_clients: 0,
};

export function useSentinelStream() {
  const [stats, setStats] = useState<TrafficStats>(EMPTY_STATS);
  const [logs, setLogs] = useState<RequestLogItem[]>([]);
  const [alerts, setAlerts] = useState<AnomalyAlertItem[]>([]);
  const [status, setStatus] = useState<ConnectionState>("connecting");
  const [isHydrating, setIsHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const retryCountRef = useRef(0);

  const fetchSnapshot = useCallback(async () => {
    try {
      setError(null);
      const [statsRes, logsRes, alertsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/stats`),
        fetch(`${API_URL}/api/v1/logs?limit=30`),
        fetch(`${API_URL}/api/v1/alerts?limit=20`),
      ]);

      if (!statsRes.ok || !logsRes.ok || !alertsRes.ok) {
        throw new Error("Backend returned a non-OK response while hydrating.");
      }

      const [statsData, logsData, alertsData] = await Promise.all([
        statsRes.json(),
        logsRes.json(),
        alertsRes.json(),
      ]);

      setStats(statsData);
      setLogs(
        logsData.map((item: Record<string, unknown>) => ({
          id: `db-${item.id}`,
          api_key_id: (item.api_key_id as number) ?? null,
          client_ip: String(item.client_ip ?? ""),
          endpoint: String(item.endpoint ?? ""),
          status_code: Number(item.status_code ?? 200),
          allowed: Boolean(item.allowed),
          latency_ms: Number(item.latency_ms ?? 0),
          timestamp: String(item.created_at ?? new Date().toISOString()),
        }))
      );
      setAlerts(
        alertsData.map((item: Record<string, unknown>) => ({
          id: `db-alert-${item.id}`,
          api_key_id: (item.api_key_id as number) ?? null,
          client_ip: String(item.client_ip ?? ""),
          alert_type: String(item.alert_type ?? "UNKNOWN"),
          severity: String(item.severity ?? "MEDIUM"),
          details: String(item.details ?? ""),
          timestamp: String(item.created_at ?? new Date().toISOString()),
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reach Sentinel API (Render may still be waking up)."
      );
    } finally {
      setIsHydrating(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    fetchSnapshot();

    const connect = () => {
      if (!active) return;
      setStatus(retryCountRef.current === 0 ? "connecting" : "reconnecting");

      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        if (!active) return;
        retryCountRef.current = 0;
        setStatus("live");
        setError(null);
      };

      ws.onmessage = (event) => {
        if (!active) return;
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "request") {
            const nextLog: RequestLogItem = {
              id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              api_key_id: msg.api_key_id ?? null,
              key_name: msg.key_name,
              tier: msg.tier,
              client_ip: msg.client_ip ?? "unknown",
              endpoint: msg.endpoint ?? "/api/v1/resource",
              status_code: Number(msg.status_code ?? 200),
              allowed: Boolean(msg.allowed),
              latency_ms: Number(msg.latency_ms ?? 0),
              timestamp: msg.timestamp ?? new Date().toISOString(),
            };

            setLogs((prev) => [nextLog, ...prev].slice(0, MAX_BUFFER));
            setStats((prev) => {
              const total = prev.total_requests + 1;
              const blocked = prev.blocked_requests + (nextLog.allowed ? 0 : 1);
              const avgLatency =
                total === 1
                  ? nextLog.latency_ms
                  : ((prev.avg_latency_ms * prev.total_requests) + nextLog.latency_ms) / total;

              return {
                ...prev,
                total_requests: total,
                blocked_requests: blocked,
                block_rate_percent: Number(((blocked / total) * 100).toFixed(2)),
                avg_latency_ms: Number(avgLatency.toFixed(2)),
              };
            });
          } else if (msg.type === "anomaly") {
            const nextAlert: AnomalyAlertItem = {
              id: `ws-alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              api_key_id: msg.api_key_id ?? null,
              key_name: msg.key_name,
              client_ip: msg.client_ip ?? "unknown",
              alert_type: msg.alert_type ?? "ANOMALY",
              severity: msg.severity ?? "HIGH",
              details: msg.details ?? "",
              timestamp: msg.timestamp ?? new Date().toISOString(),
            };

            setAlerts((prev) => [nextAlert, ...prev].slice(0, MAX_BUFFER));
            setStats((prev) => ({
              ...prev,
              total_alerts: prev.total_alerts + 1,
            }));
          }
        } catch {
          // Ignore malformed frames
        }
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        if (!active) return;
        const delayMs = Math.min(1000 * 2 ** retryCountRef.current, 15000);
        retryCountRef.current += 1;
        setStatus(retryCountRef.current > 5 ? "offline" : "reconnecting");
        reconnectTimer = setTimeout(connect, delayMs);
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [fetchSnapshot]);

  return { stats, logs, alerts, status, isHydrating, error, refresh: fetchSnapshot };
}