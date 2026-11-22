# Sentinel Dashboard — Real-Time API Telemetry Console

Live observability console for **[Sentinel API](https://github.com/ASH777dev/sentinel-api)**, visualizing distributed Redis Lua sliding-window rate limits, rolling latency, and anomaly alerts over WebSockets.

- **Live Dashboard:** `https://sentinel-dashboard-bay-three.vercel.app/`
- **Backend Repository:** [ASH777dev/sentinel-api](https://github.com/ASH777dev/sentinel-api)
- **Live API Docs:** `https://sentinel-api-l9hc.onrender.com`

---

## Key Engineering Highlights

- **Resilient WebSocket Stream (`useSentinelStream`):** Hydrates historical metrics from Neon PostgreSQL, auto-reconnects with exponential backoff across Render cold starts, cleans up cleanly under React Strict Mode, and caps live state in a **50-item ring buffer** to prevent browser memory leaks.
- **Operator Controls:** Supports **Pause/Resume** snapshot inspection without dropping background stream updates, status filtering (`All`, `200 OK`, `429 Blocked`), and client-side **rolling p95 latency** calculation.
- **Built-In Traffic Simulator:** Mint live `free` (5 req/min) or `pro` (20 req/min) SHA-256 API keys and trigger 9x request bursts directly from the UI to watch `429` rejections and `VELOCITY_SPIKE` / `RATE_LIMIT_ABUSE` alerts fire in real time.

## Tech Stack

Next.js (App Router) • TypeScript • Tailwind CSS • Recharts • Lucide Icons • WebSockets (`wss://`)

## Local Setup

```bash
git clone [https://github.com/ASH777dev/sentinel-dashboard.git](https://github.com/ASH777dev/sentinel-dashboard.git)
cd sentinel-dashboard
npm install
