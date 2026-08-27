import React, { useState, useEffect, useRef } from 'react';
import useSirenAudio from '../hooks/useSirenAudio';

/**
 * GateController Component — Module 6
 * Simulates physical transit turnstile gate access control, visual barrier states,
 * automated lockdown timer, manual officer override, and Web Audio siren sound FX.
 */
export default function GateController({
  isLocked: propIsLocked,
  isAlert = false,
  onUnlock,
  onResetAlert
}) {
  const [internalLocked, setInternalLocked] = useState(false);
  const [lockdownCountdown, setLockdownCountdown] = useState(0);
  const [manualOverrideActive, setManualOverrideActive] = useState(false);

  const isLocked = propIsLocked !== undefined ? propIsLocked : internalLocked;

  const { startSiren, stopSiren, toggleMute, isMuted, isPlaying } = useSirenAudio();
  const timerRef = useRef(null);

  // Sync with incoming Edge Camera alert or external lock state
  useEffect(() => {
    const alertActive = propIsLocked || isAlert;
    if (alertActive && !manualOverrideActive) {
      triggerLockdown();
    } else if (!alertActive && isLocked) {
      handleAutoUnlock();
    }
  }, [propIsLocked, isAlert, manualOverrideActive]);

  // Handle Lockdown Trigger
  const triggerLockdown = () => {
    setInternalLocked(true);
    setLockdownCountdown(5);
    startSiren();

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setLockdownCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoUnlock();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Automated unlock after timer expires
  const handleAutoUnlock = () => {
    setInternalLocked(false);
    stopSiren();
    if (onUnlock) onUnlock();
    if (onResetAlert) onResetAlert();
  };

  // Security Officer Manual Override
  const handleManualOverride = () => {
    setManualOverrideActive(true);
    setInternalLocked(false);
    setLockdownCountdown(0);
    stopSiren();

    if (timerRef.current) clearInterval(timerRef.current);
    if (onUnlock) onUnlock();
    if (onResetAlert) onResetAlert();

    // Reset override latch after 3 seconds so subsequent real alerts can trigger again
    setTimeout(() => {
      setManualOverrideActive(false);
    }, 3000);
  };

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <span style={styles.gateIcon}>🚧</span>
          <div>
            <h3 style={styles.title}>Physical Turnstile Access Controller</h3>
            <span style={styles.subText}>Hardware Link: Gate_04_Motor_Relay</span>
          </div>
        </div>

        {/* Audio Mute Toggle Button */}
        <button
          onClick={toggleMute}
          style={{
            ...styles.muteButton,
            backgroundColor: isMuted ? '#475569' : '#0284c7'
          }}
          title={isMuted ? 'Unmute Siren Alarm' : 'Mute Siren Alarm'}
        >
          {isMuted ? '🔇 Audio Muted' : isPlaying ? '🔊 Siren Active' : '🔈 Siren Ready'}
        </button>
      </div>

      {/* Turnstile Visual Simulation Box */}
      <div
        style={{
          ...styles.turnstileView,
          borderColor: isLocked ? '#ef4444' : '#10b981',
          backgroundColor: isLocked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.05)'
        }}
      >
        {/* Animated Barrier Graphic */}
        <div style={styles.barrierGraphic}>
          <div
            style={{
              ...styles.barrierBar,
              backgroundColor: isLocked ? '#ef4444' : '#10b981',
              transform: isLocked ? 'rotate(0deg)' : 'rotate(-65deg)',
              boxShadow: isLocked ? '0 0 15px #ef4444' : '0 0 10px #10b981'
            }}
          />
          <div style={styles.pillar} />
        </div>

        {/* Status Text & Indicators */}
        <div style={styles.statusSection}>
          <div style={styles.indicatorRow}>
            <span
              style={{
                ...styles.statusLed,
                backgroundColor: isLocked ? '#ef4444' : '#10b981',
                boxShadow: isLocked ? '0 0 12px #ef4444' : '0 0 12px #10b981'
              }}
            />
            <span
              style={{
                ...styles.statusHeading,
                color: isLocked ? '#f87171' : '#34d399'
              }}
            >
              {isLocked
                ? '🚨 PHYSICAL LOCKDOWN: TURNSTILE BLOCKED'
                : '✅ GATE 04: PASSAGE AUTHORIZED'}
            </span>
          </div>

          <p style={styles.statusDescription}>
            {isLocked
              ? `Multiple entry anomaly detected. Turnstile motor solenoid is magnetically LOCKED for ${lockdownCountdown}s.`
              : 'Turnstile motor is energized. Single-passenger passage authorized.'}
          </p>

          {/* Countdown Progress Bar (During Lockout) */}
          {isLocked && (
            <div style={styles.progressBarBg}>
              <div
                style={{
                  ...styles.progressBarFill,
                  width: `${(lockdownCountdown / 5) * 100}%`
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Controller Actions Footer */}
      <div style={styles.footer}>
        <button
          onClick={handleManualOverride}
          style={{
            ...styles.overrideButton,
            opacity: isLocked ? 1 : 0.7
          }}
          disabled={!isLocked}
        >
          👮‍♂️ Officer Manual Override (Unlock & Clear)
        </button>

        {/* Demo Simulation Trigger */}
        <button
          onClick={triggerLockdown}
          style={styles.demoTriggerButton}
        >
          ⚡ Simulate Breach
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: {
    width: '100%',
    maxWidth: '640px',
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    border: '1px solid #334155',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
    marginTop: '20px',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    padding: '14px 18px',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  gateIcon: {
    fontSize: '1.4rem'
  },
  title: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: '700',
    color: '#f8fafc'
  },
  subText: {
    fontSize: '0.72rem',
    color: '#94a3b8',
    fontFamily: 'monospace'
  },
  muteButton: {
    padding: '6px 12px',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s ease'
  },
  turnstileView: {
    padding: '18px',
    margin: '16px',
    borderRadius: '10px',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    transition: 'all 0.3s ease'
  },
  barrierGraphic: {
    position: 'relative',
    width: '60px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  pillar: {
    position: 'absolute',
    width: '14px',
    height: '40px',
    backgroundColor: '#64748b',
    borderRadius: '4px',
    zIndex: 1
  },
  barrierBar: {
    position: 'absolute',
    width: '45px',
    height: '6px',
    borderRadius: '3px',
    transformOrigin: 'left center',
    left: '26px',
    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease',
    zIndex: 2
  },
  statusSection: {
    flex: 1
  },
  indicatorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px'
  },
  statusLed: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0
  },
  statusHeading: {
    fontSize: '0.88rem',
    fontWeight: '800',
    letterSpacing: '0.02em'
  },
  statusDescription: {
    margin: '4px 0 0',
    fontSize: '0.78rem',
    color: '#cbd5e1',
    lineHeight: '1.4'
  },
  progressBarBg: {
    marginTop: '10px',
    height: '6px',
    backgroundColor: '#334155',
    borderRadius: '3px',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ef4444',
    transition: 'width 1s linear'
  },
  footer: {
    padding: '12px 18px',
    backgroundColor: '#1e293b',
    borderTop: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px'
  },
  overrideButton: {
    flex: 2,
    padding: '10px 14px',
    backgroundColor: '#e11d48',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '0.82rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  demoTriggerButton: {
    flex: 1,
    padding: '10px 14px',
    backgroundColor: '#334155',
    color: '#f8fafc',
    border: '1px solid #475569',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.82rem',
    cursor: 'pointer'
  }
};
