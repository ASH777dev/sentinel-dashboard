export interface TrafficStats {
  total_requests: number;
  blocked_requests: number;
  block_rate_percent: number;
  avg_latency_ms: number;
  total_alerts: number;
  active_ws_clients: number;
}

export interface RequestLogItem {
  id: string;
  api_key_id: number | null;
  key_name?: string;
  tier?: string;
  client_ip: string;
  endpoint: string;
  status_code: number;
  allowed: boolean;
  latency_ms: number;
  timestamp: string;
}

export interface AnomalyAlertItem {
  id: string;
  api_key_id: number | null;
  key_name?: string;
  client_ip: string;
  alert_type: "VELOCITY_SPIKE" | "RATE_LIMIT_ABUSE" | string;
  severity: "LOW" | "MEDIUM" | "HIGH" | string;
  details: string;
  timestamp: string;
}

export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

export interface IssuedApiKey {
  id: number;
  name: string;
  tier: "free" | "pro";
  rate_limit: number;
  window_seconds: number;
  api_key: string;
}