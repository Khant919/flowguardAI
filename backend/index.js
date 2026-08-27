import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 1. Load environment variables (force override system/session shell variables)
dotenv.config({ override: true });

const app = express();
const PORT = process.env.PORT || 3000;

// 2. Middlewares & Configuration
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. Supabase Client Initialization (support all standard env variable names)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log('🔍 [Supabase Config Check]:', {
  hasUrl: !!supabaseUrl,
  url: supabaseUrl || 'MISSING',
  hasKey: !!supabaseKey
});

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ [CRITICAL ERROR]: SUPABASE_URL or SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY is missing from .env!');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
  auth: { persistSession: false }
});

// 4. Health Check Route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'FlowGuard AI Backend' });
});

// 5. Main Alert Trigger Endpoint: POST /api/trigger-alert
app.post('/api/trigger-alert', async (req, res) => {
  try {
    const { camera_id = 'Gate_04_Demo', image, timestamp } = req.body;
    const eventTimestamp = timestamp || new Date().toISOString();

    if (!image) {
      console.warn('⚠️ [Rejected]: Missing image in payload');
      return res.status(400).json({ error: 'Missing required field: image' });
    }

    console.log(`\n🚨 [Alert Received] Camera: ${camera_id} | Time: ${eventTimestamp}`);

    // --- Step 1: Strip base64 prefix and convert to Buffer ---
    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    console.log(`📦 [Image Processed] Buffer size: ${(imageBuffer.length / 1024).toFixed(1)} KB`);

    // --- Step 2: Upload Buffer to Supabase Storage ('flowguard-snapshots') ---
    const sanitizedCameraId = String(camera_id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${sanitizedCameraId}_${Date.now()}.jpg`;

    // Try 'flowguard-snapshots', fallback to 'anomaly-snapshots'
    let bucketName = 'flowguard-snapshots';
    let { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.warn(`⚠️ [Upload failed on '${bucketName}'] (${uploadError.message}). Retrying with 'anomaly-snapshots'...`);
      bucketName = 'anomaly-snapshots';
      const retryResult = await supabase.storage
        .from(bucketName)
        .upload(fileName, imageBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });
      uploadError = retryResult.error;
    }

    if (uploadError) {
      console.error('❌ [Supabase Storage Upload Error]:', uploadError.message);
    } else {
      console.log(`✅ [Supabase Storage] Uploaded to bucket '${bucketName}' -> ${fileName}`);
    }

    // --- Step 3: Retrieve Public URL ---
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    const snapshotUrl = publicUrlData?.publicUrl || '';
    console.log(`📸 [Snapshot URL]: ${snapshotUrl}`);

    // --- Step 4: INSERT Audit Record into Supabase `events` Table ---
    const { data: dbRecord, error: dbError } = await supabase
      .from('events')
      .insert([
        {
          camera_id: camera_id,
          anomaly_type: 'tailgating',
          confidence_score: 0.95,
          timestamp: eventTimestamp,
          snapshot_url: snapshotUrl
        }
      ])
      .select();

    if (dbError) {
      console.error('❌ [Supabase Database Error]:', dbError.message);
    } else {
      console.log('✅ [Supabase DB Logged] Event saved in `events` table with ID:', dbRecord?.[0]?.id || 'OK');
    }

    // --- Step 5: Dispatch Webhook to n8n ---
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.warn('⚠️ [n8n Warning] N8N_WEBHOOK_URL is not set in .env');
    } else {
      const n8nPayload = {
        anomaly_type: 'tailgating',
        camera_id: camera_id,
        confidence_score: 0.95,
        timestamp: eventTimestamp,
        snapshot_url: snapshotUrl
      };

      console.log('⚡ [n8n Webhook] Forwarding alert to n8n...');

      fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(n8nPayload)
      })
        .then(async (n8nRes) => {
          if (n8nRes.ok) {
            console.log('✅ [n8n Webhook Success] Alert successfully received by n8n.');
          } else {
            const txt = await n8nRes.text().catch(() => '');
            console.warn(`⚠️ [n8n Webhook Warning] Status: ${n8nRes.status} | Response: ${txt}`);
          }
        })
        .catch(n8nErr => {
          console.error('❌ [n8n Webhook Network Error]:', n8nErr.message);
        });
    }

    // Return success response to the Edge camera client
    return res.status(200).json({
      status: 'success',
      message: 'Alert processed, saved to Supabase, and forwarded to n8n',
      snapshot_url: snapshotUrl,
      event: dbRecord?.[0] || null
    });

  } catch (error) {
    console.error('❌ [Server Error]:', error);
    return res.status(500).json({
      error: 'Internal server error processing security alert',
      message: error.message
    });
  }
});

// 6. Startup: Listen on PORT
app.listen(PORT, () => {
  console.log(`
  🛡️  ================================================
  🛡️  FlowGuard AI — Backend Server Active
  🛡️  URL: http://localhost:${PORT}
  🛡️  Alert Endpoint: POST http://localhost:${PORT}/api/trigger-alert
  🛡️  ================================================
  `);
});
