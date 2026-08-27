import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

/**
 * Calculates Intersection over Union (IoU) between two bounding boxes [x, y, width, height]
 */
function calculateIoU(boxA, boxB) {
  const [ax, ay, aw, ah] = boxA;
  const [bx, by, bw, bh] = boxB;

  const xA = Math.max(ax, bx);
  const yA = Math.max(ay, by);
  const xB = Math.min(ax + aw, bx + bw);
  const yB = Math.min(ay + ah, by + bh);

  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const boxAArea = aw * ah;
  const boxBArea = bw * bh;

  const unionArea = boxAArea + boxBArea - interArea;
  if (unionArea <= 0) return 0;
  return interArea / unionArea;
}

/**
 * Filters out duplicate overlapping person boxes (Non-Maximum Suppression)
 */
function filterOverlappingPersons(persons, iouThreshold = 0.35) {
  const sorted = [...persons].sort((a, b) => b.score - a.score);
  const kept = [];

  for (const person of sorted) {
    let hasOverlap = false;
    for (const chosen of kept) {
      if (calculateIoU(person.bbox, chosen.bbox) > iouThreshold) {
        hasOverlap = true;
        break;
      }
    }
    if (!hasOverlap) {
      kept.push(person);
    }
  }
  return kept;
}

export default function EdgeCamera({ onAlertTrigger }) {
  const [appState, setAppState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [personCount, setPersonCount] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.75);

  const videoRef = useRef(null);
  const visibleCanvasRef = useRef(null);
  const hiddenCanvasRef = useRef(null);

  const streamRef = useRef(null);
  const modelRef = useRef(null);
  const intervalRef = useRef(null);
  const cooldownTimeoutRef = useRef(null);
  const isCooldownActiveRef = useRef(false);
  const thresholdRef = useRef(confidenceThreshold);

  useEffect(() => {
    thresholdRef.current = confidenceThreshold;
  }, [confidenceThreshold]);

  const initCameraAndAI = useCallback(async () => {
    try {
      setAppState('loading');
      setErrorMessage('');

      await tf.ready();
      const model = await cocoSsd.load({ base: 'mobilenet_v2' });
      modelRef.current = model;

      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play().catch(err => console.error("Webcam error:", err));
            }
          };
        }
      }

      setAppState('monitoring');
      startInferenceLoop();

    } catch (error) {
      console.error("Initialization error:", error);
      setAppState('error');
      if (error.message?.includes('fetch') || error.name === 'TypeError') {
        setErrorMessage('Network error: Failed to download AI model weights. Please check your internet connection.');
      } else {
        setErrorMessage(error.message || 'Camera or model initialization failed.');
      }
    }
  }, []);

  useEffect(() => {
    initCameraAndAI();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [initCameraAndAI]);

  const startInferenceLoop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      const visibleCanvas = visibleCanvasRef.current;
      const hiddenCanvas = hiddenCanvasRef.current;
      const model = modelRef.current;

      if (!video || !visibleCanvas || !hiddenCanvas || !model) return;
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

      try {
        const rawPredictions = await model.detect(video);
        const currentThreshold = thresholdRef.current;

        const confidentPersons = rawPredictions.filter(
          p => p.class === 'person' && p.score >= currentThreshold
        );

        const uniquePersons = filterOverlappingPersons(confidentPersons, 0.35);
        const personsFound = uniquePersons.length;
        setPersonCount(personsFound);

        const ctx = visibleCanvas.getContext('2d');
        ctx.clearRect(0, 0, 640, 480);

        uniquePersons.forEach(prediction => {
          const [x, y, width, height] = prediction.bbox;
          const label = `person (${Math.round(prediction.score * 100)}%)`;

          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(x, y, width, height);

          ctx.font = 'bold 12px monospace';
          const textWidth = ctx.measureText(label).width;
          const textHeight = 16;
          const labelY = y > 20 ? y - textHeight - 2 : y;

          ctx.fillStyle = '#00FFFF';
          ctx.fillRect(x, labelY, textWidth + 8, textHeight + 2);

          ctx.fillStyle = '#000000';
          ctx.fillText(label, x + 4, labelY + textHeight - 3);
        });

        if (personsFound >= 2) {
          handleTailgatingTrigger(video, hiddenCanvas);
        }
      } catch (detectErr) {
        console.error("Frame detection error:", detectErr);
      }
    }, 1000);
  };

  const handleTailgatingTrigger = (video, hiddenCanvas) => {
    if (isCooldownActiveRef.current) return;

    isCooldownActiveRef.current = true;
    setAppState('alert');
    setCooldownRemaining(4);
    if (onAlertTrigger) onAlertTrigger();

    const hiddenCtx = hiddenCanvas.getContext('2d');
    hiddenCtx.drawImage(video, 0, 0, 640, 480);
    const base64Image = hiddenCanvas.toDataURL('image/jpeg', 0.85);

    const timestampISO = new Date().toISOString();

    fetch('http://localhost:3000/api/trigger-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        camera_id: 'Gate_04_Demo',
        anomaly_type: 'tailgating',
        image: base64Image,
        timestamp: timestampISO
      })
    })
      .then(res => res.json())
      .then(data => console.log('[FlowGuard API] Alert delivered:', data))
      .catch(err => console.warn('[FlowGuard API] Alert network error:', err));

    let countdown = 4;
    const countdownInterval = setInterval(() => {
      countdown -= 1;
      setCooldownRemaining(countdown);
      if (countdown <= 0) clearInterval(countdownInterval);
    }, 1000);

    cooldownTimeoutRef.current = setTimeout(() => {
      isCooldownActiveRef.current = false;
      setAppState('monitoring');
      setCooldownRemaining(0);
    }, 4000);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div
          style={{
            ...styles.banner,
            backgroundColor:
              appState === 'loading'
                ? '#475569'
                : appState === 'alert'
                ? '#ef4444'
                : appState === 'error'
                ? '#b91c1c'
                : '#10b981',
            boxShadow:
              appState === 'alert'
                ? '0 0 20px rgba(239, 68, 68, 0.6)'
                : 'none'
          }}
        >
          {appState === 'loading' && (
            <span>⏳ Loading AI Model & Camera...</span>
          )}
          {appState === 'monitoring' && (
            <span>✅ Monitoring — {personCount} Person(s) Detected</span>
          )}
          {appState === 'alert' && (
            <span>
              🚨 ALERT: TAILGATING {cooldownRemaining > 0 ? `(${cooldownRemaining}s)` : ''}
            </span>
          )}
          {appState === 'error' && (
            <span>⚠️ {errorMessage}</span>
          )}
        </div>

        <div style={styles.videoWrapper}>
          <video
            ref={videoRef}
            width="640"
            height="480"
            playsInline
            muted
            style={styles.video}
          />
          <canvas
            ref={visibleCanvasRef}
            width="640"
            height="480"
            style={styles.overlayCanvas}
          />

          {appState === 'error' && (
            <div style={styles.errorOverlay}>
              <p style={{ color: '#f87171', fontWeight: '600', textAlign: 'center', maxWidth: '80%' }}>
                {errorMessage}
              </p>
              <button
                onClick={initCameraAndAI}
                style={styles.retryButton}
              >
                🔄 Retry Loading AI Model
              </button>
            </div>
          )}
        </div>

        <canvas
          ref={hiddenCanvasRef}
          width="640"
          height="480"
          style={{ display: 'none' }}
        />

        <div style={styles.controlsBar}>
          <div style={styles.sliderGroup}>
            <label style={styles.sliderLabel}>
              🎯 Confidence Filter: <strong>{Math.round(confidenceThreshold * 100)}%</strong>
            </label>
            <input
              type="range"
              min="0.55"
              max="0.90"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
              style={styles.slider}
            />
          </div>
          <span style={styles.modelTag}>Model: mobilenet_v2 (High Precision)</span>
        </div>

        <div style={styles.footer}>
          <span>Camera: <strong>Gate_04_Demo</strong></span>
          <span>Trigger: <strong>Tailgating (&ge; 2 persons)</strong></span>
        </div>

      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  card: {
    width: '640px',
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
    border: '1px solid #334155'
  },
  banner: {
    padding: '12px',
    textAlign: 'center',
    color: '#ffffff',
    fontWeight: '700',
    fontSize: '0.95rem',
    letterSpacing: '0.03em',
    transition: 'all 0.3s ease'
  },
  videoWrapper: {
    position: 'relative',
    width: '640px',
    height: '480px',
    backgroundColor: '#000000'
  },
  video: {
    display: 'block',
    width: '640px',
    height: '480px',
    objectFit: 'cover'
  },
  overlayCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '640px',
    height: '480px',
    pointerEvents: 'none'
  },
  controlsBar: {
    padding: '10px 16px',
    backgroundColor: '#1e293b',
    borderTop: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px'
  },
  sliderGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  sliderLabel: {
    fontSize: '0.75rem',
    color: '#cbd5e1',
    fontWeight: '600'
  },
  slider: {
    cursor: 'pointer',
    accentColor: '#38bdf8',
    width: '120px'
  },
  modelTag: {
    fontSize: '0.7rem',
    color: '#94a3b8',
    backgroundColor: '#0f172a',
    padding: '3px 8px',
    borderRadius: '4px',
    border: '1px solid #334155',
    fontFamily: 'monospace'
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    zIndex: 20
  },
  retryButton: {
    padding: '10px 20px',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.9rem',
    cursor: 'pointer'
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 16px',
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    fontSize: '0.82rem',
    borderTop: '1px solid #334155'
  }
};
