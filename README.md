# 🛡️ FlowGuard AI — Autonomous Transit Security Platform

> **Edge AI Computer Vision • Real-Time Tailgating Detection • Automated Incident Dispatch**

FlowGuard AI is an intelligent, edge-first security checkpoint system designed for modern smart transit hubs and access control points. It runs real-time deep learning models directly in the client's browser to detect tailgating anomalies, captures evidence snapshots on-device, stores audit trails in Supabase, and dispatches automated security alerts to Slack & Gmail via n8n workflows.

---

## 🌟 Key Architecture & Modules

```
[ Edge Webcam Feed ]
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              MODULE 1: Edge AI Client                   │
│  - Real-time COCO-SSD object detection (TensorFlow.js)  │
│  - IoU Non-Maximum Suppression & False-Positive Filter  │
│  - Base64 snapshot capture upon anomaly (≥ 2 persons)   │
└──────────────────────────┬──────────────────────────────┘
                           │ (Dispatched ONLY on Tailgating)
                           ▼
┌─────────────────────────────────────────────────────────┐
│             MODULE 2: Express API Gateway               │
│  - 50MB payload limit for high-resolution snapshots     │
│  - Base64 to Binary Buffer decoding                     │
│  - Supabase Storage upload & Postgres audit insert      │
│  - Non-blocking n8n Webhook forwarder                   │
└──────────────────────────┬──────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│ MODULE 3: Persistence Layer   │   │  MODULE 4: Automated Dispatch │
│  - Supabase `events` table    │   │  - n8n Webhook orchestration  │
│  - `flowguard-snapshots`      │   │  - Instant Slack alert cards  │
│  - Permissive RLS policies    │   │  - Gmail incident emails      │
└──────────────┬────────────────┘   └───────────────────────────────┘
               │ (WebSocket Realtime)
               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│ MODULE 5: SOC Live Dashboard  │   │ MODULE 6: Turnstile Controller│
│  - Real-time incident stream  │   │  - Web Audio dual-tone siren  │
│  - System KPI telemetry cards │   │  - Physical barrier lockdown  │
│  - Evidence thumbnail modal   │   │  - Officer manual override    │
└───────────────────────────────┘   └───────────────────────────────┘
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- A [Supabase](https://supabase.com) project
- An [n8n](https://n8n.io) instance / cloud account

---

### 2. Database & Storage Setup (Supabase)
Run the SQL script found in [`supabase_setup.sql`](./supabase_setup.sql) in your Supabase SQL Editor to provision:
- The `public.events` audit table.
- The `flowguard-snapshots` public storage bucket.
- Row-Level Security (RLS) policies.

---

### 3. Backend Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in your credentials:
   ```env
   PORT=3000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-key
   N8N_WEBHOOK_URL=https://your-n8n.cloud/webhook/flowguard-alert
   ```
3. Install dependencies and start the backend:
   ```bash
   npm install
   npm start
   ```

---

### 4. Frontend Setup

1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser and allow webcam permissions.

---

### 5. n8n Incident Response Workflow

1. Open your n8n workspace.
2. Click **Menu (`...`)** $\rightarrow$ **Import from File**.
3. Select [`n8n_flowguard_workflow.json`](./n8n_flowguard_workflow.json).
4. Set your Discord/Slack webhook credentials and toggle the workflow to **Active**.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, TensorFlow.js (`@tensorflow/tfjs`), COCO-SSD (`@tensorflow-models/coco-ssd`), Web Audio API.
- **Backend**: Node.js, Express.js, `@supabase/supabase-js`, CORS, Dotenv.
- **Database & Storage**: Supabase (PostgreSQL + S3 Storage Buckets).
- **Automation Engine**: n8n (Webhooks, Slack BlockKit, Gmail HTML notifications).

---

## 📄 License
MIT License. Built for Smart Transit Hackathon 2026.
