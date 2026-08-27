import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ [FlowGuard Gateway] SUPABASE_URL or SUPABASE key is not defined in environment variables.');
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

// ==========================================
// 1. MIDDLEWARES & CONFIGURATION
// ==========================================

// Enable CORS for local React development and production origins
app.use(cors({
  origin: '*', // Adjust or restrict to specific origin (e.g., http://localhost:5173) in production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase JSON body parser limit to support high-resolution Base64 image payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ==========================================
// 2. IN-MEMORY COOLDOWN CACHE (SPAM CONTROL)
// ==========================================
const COOLDOWN_DURATION_MS = 15 * 1000; // 15 seconds
const cameraCooldownCache = new Map(); // Key: camera_id, Value: timestamp (ms)

/**
 * Periodically purge stale entries from the cooldown cache to prevent memory leaks.
 */
setInterval(() => {
  const now = Date.now();
  for (const [cameraId, lastAlertTime] of cameraCooldownCache.entries()) {
    if (now - lastAlertTime > COOLDOWN_DURATION_MS * 2) {
      cameraCooldownCache.delete(cameraId);
    }
  }
}, 60 * 1000);

// ==========================================
// 3. API ENDPOINTS
// ==========================================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', module: 'FlowGuard AI - API Gateway' });
});

/**
 * Main Anomaly Alert Ingestion Endpoint
 * Route: POST /api/trigger-alert
 */
app.post('/api/trigger-alert', async (req, res) => {
  const { camera_id = 'Gate_Unknown', image, timestamp } = req.body;
  const eventTimestamp = timestamp || new Date().toISOString();

  // Validate required payload
  if (!image) {
    return res.status(400).json({ error: 'Missing required "image" payload' });
  }

  // --- Step 1: In-Memory Cooldown Check ---
  const currentTime = Date.now();
  const lastAlertTimestamp = cameraCooldownCache.get(camera_id);

  if (lastAlertTimestamp && (currentTime - lastAlertTimestamp) < COOLDOWN_DURATION_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_DURATION_MS - (currentTime - lastAlertTimestamp)) / 1000);
    console.log(`⏳ [Cooldown Active] Alert from "${camera_id}" suppressed (${remainingSeconds}s remaining).`);
    return res.status(200).json({
      status: 'cooldown_active',
      message: 'Alert dropped to prevent spam'
    });
  }

  // Update cooldown timestamp for this camera
  cameraCooldownCache.set(camera_id, currentTime);
  console.log(`🚨 [Anomaly Received] Processing alert from "${camera_id}" at ${eventTimestamp}`);

  try {
    // --- Step 2: Process Base64 Image & Convert to Buffer ---
    // Remove Data URL metadata prefix if present (e.g., "data:image/jpeg;base64,")
    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    // Generate unique storage file path
    const sanitizedCameraId = camera_id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${sanitizedCameraId}/${Date.now()}_snapshot.jpg`;

    // --- Step 3: Supabase Storage Upload ---
    let publicSnapshotUrl = '';
    
    const { data: storageData, error: storageError } = await supabase.storage
      .from('anomaly-snapshots')
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (storageError) {
      console.error('❌ [Supabase Storage Error]:', storageError.message);
      // Fallback placeholder URL if storage fails
      publicSnapshotUrl = `https://storage.placeholder.com/${fileName}`;
    } else {
      const { data: publicUrlData } = supabase.storage
        .from('anomaly-snapshots')
        .getPublicUrl(fileName);
      
      publicSnapshotUrl = publicUrlData?.publicUrl || '';
      console.log(`📸 [Snapshot Uploaded]: ${publicSnapshotUrl}`);
    }

    // --- Step 4: Supabase Postgres Audit Log (`events` table) ---
    const { data: eventRecord, error: dbError } = await supabase
      .from('events')
      .insert([
        {
          camera_id: camera_id,
          anomaly_type: 'tailgating',
          confidence_score: 0.95,
          timestamp: eventTimestamp,
          snapshot_url: publicSnapshotUrl
        }
      ])
      .select();

    if (dbError) {
      console.error('❌ [Supabase Database Error]:', dbError.message);
    } else {
      console.log('✅ [Database Logged] Event saved with ID:', eventRecord?.[0]?.id || 'OK');
    }

    // --- Step 5: Trigger n8n Automated Workflow ---
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    if (n8nWebhookUrl) {
      const n8nPayload = {
        event: 'Tailgating Detected',
        camera_id: camera_id,
        timestamp: eventTimestamp,
        snapshot_url: publicSnapshotUrl
      };

      // Non-blocking fire-and-forget call to n8n webhook
      fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(n8nPayload)
      })
        .then(response => {
          if (!response.ok) {
            console.warn(`⚠️ [n8n Webhook] Received status ${response.status}`);
          } else {
            console.log('⚡ [n8n Webhook Dispatched] Workflow successfully triggered.');
          }
        })
        .catch(n8nErr => {
          console.error('❌ [n8n Webhook Error]:', n8nErr.message);
        });
    } else {
      console.warn('ℹ️ [n8n Webhook] Skipped: N8N_WEBHOOK_URL is not set in .env');
    }

    // Return immediate response to Edge client
    return res.status(200).json({
      status: 'alert_processed_and_routed'
    });

  } catch (err) {
    console.error('❌ [Server Error Processing Alert]:', err);
    // Return 500 error gracefully without crashing server
    return res.status(500).json({
      error: 'Internal server error while processing security alert',
      details: err.message
    });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`
  🛡️  ==============================================
  🛡️  FlowGuard AI — Module 2: API Gateway
  🛡️  Server listening on: http://localhost:${PORT}
  🛡️  Endpoint: POST http://localhost:${PORT}/api/trigger-alert
  🛡️  Cooldown Window: ${COOLDOWN_DURATION_MS / 1000}s per camera
  🛡️  ==============================================
  `);
});
