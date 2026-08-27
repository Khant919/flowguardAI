import React, { useState, useEffect } from 'react'
import EdgeCamera from './components/EdgeCamera'
import GateController from './components/GateController'
import SecurityDashboard from './components/SecurityDashboard'

/**
 * FlowGuard AI — Final Command Center (App.jsx)
 * Lead Frontend Architecture for Hackathon Presentation
 */
export default function App() {
  // Shared global state for alert / turnstile lockdown
  const [isLocked, setIsLocked] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Live Digital Clock updating every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={styles.appContainer}>
      {/* ========================================================================= */}
      {/* 1. Sleek Top Navigation Bar */}
      {/* ========================================================================= */}
      <header style={styles.navHeader}>
        <div style={styles.brandGroup}>
          <div style={styles.logoShield}>🛡️</div>
          <div>
            <div style={styles.brandTitleRow}>
              <h1 style={styles.brandTitle}>FlowGuard AI</h1>
              <span style={styles.versionBadge}>v2.4 SECURE</span>
            </div>
            <span style={styles.brandSubtitle}>
              Autonomous Transit Security Platform • Edge Computer Vision & Incident Response
            </span>
          </div>
        </div>

        {/* Clock & Status Indicators */}
        <div style={styles.headerRight}>
          {/* Live System Clock */}
          <div style={styles.clockCard}>
            <span style={styles.clockLabel}>SYSTEM TIME</span>
            <span style={styles.clockValue}>
              {currentTime.toLocaleTimeString('en-US', { hour12: false })}{' '}
              <span style={styles.clockDate}>
                {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </span>
          </div>

          {/* Operational Status Dot */}
          <div
            style={{
              ...styles.statusBadge,
              backgroundColor: isLocked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              borderColor: isLocked ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.3)'
            }}
          >
            <span
              style={{
                ...styles.statusDot,
                backgroundColor: isLocked ? '#ef4444' : '#10b981',
                boxShadow: isLocked ? '0 0 10px #ef4444' : '0 0 10px #10b981'
              }}
            />
            <span
              style={{
                ...styles.statusText,
                color: isLocked ? '#f87171' : '#34d399'
              }}
            >
              {isLocked ? 'BREACH DETECTED' : 'SYSTEM OPERATIONAL'}
            </span>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. Split-Screen Grid Command Center */}
      {/* ========================================================================= */}
      <main style={styles.dashboardGrid}>
        {/* LEFT COLUMN (45% Width): Edge Camera + Physical Gate Controller */}
        <section style={styles.leftColumn}>
          <div style={styles.columnHeader}>
            <span style={styles.columnIcon}>📹</span>
            <h2 style={styles.columnTitle}>Edge Surveillance & Access Control</h2>
          </div>

          {/* Module 1: Live Edge Camera */}
          <div style={styles.componentWrapper}>
            <EdgeCamera
              onAlert={() => setIsLocked(true)}
              onAlertTrigger={() => setIsLocked(true)}
            />
          </div>

          {/* Module 6: Physical Turnstile Gate Controller & Siren */}
          <div style={styles.componentWrapper}>
            <GateController
              isLocked={isLocked}
              isAlert={isLocked}
              onUnlock={() => setIsLocked(false)}
              onResetAlert={() => setIsLocked(false)}
            />
          </div>
        </section>

        {/* RIGHT COLUMN (55% Width): SOC Real-Time Operations Feed */}
        <section style={styles.rightColumn}>
          <div style={styles.columnHeader}>
            <span style={styles.columnIcon}>📊</span>
            <h2 style={styles.columnTitle}>Security Operations Center (SOC) Telemetry</h2>
          </div>

          {/* Module 5: Real-Time Incident Table & KPI Metrics */}
          <div style={{ ...styles.componentWrapper, height: '100%' }}>
            <SecurityDashboard isAlert={isLocked} />
          </div>
        </section>
      </main>
    </div>
  )
}

// =============================================================================
// Sleek High-Tech Dark Theme Styles
// =============================================================================
const styles = {
  appContainer: {
    backgroundColor: '#090d16',
    minHeight: '100vh',
    color: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column'
  },
  navHeader: {
    padding: '12px 24px',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px'
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  logoShield: {
    fontSize: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '42px',
    height: '42px',
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderRadius: '10px',
    border: '1px solid rgba(2, 132, 199, 0.3)'
  },
  brandTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  brandTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    color: '#f8fafc'
  },
  versionBadge: {
    fontSize: '0.65rem',
    fontWeight: '700',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '0.05em'
  },
  brandSubtitle: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    display: 'block',
    marginTop: '2px'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  clockCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    backgroundColor: '#1e293b',
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #334155'
  },
  clockLabel: {
    fontSize: '0.6rem',
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: '0.05em'
  },
  clockValue: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#38bdf8',
    fontFamily: 'monospace'
  },
  clockDate: {
    color: '#94a3b8',
    fontSize: '0.72rem',
    marginLeft: '4px',
    fontFamily: 'sans-serif'
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid',
    transition: 'all 0.3s ease'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    animation: 'pulse 1.5s infinite ease-in-out'
  },
  statusText: {
    fontSize: '0.75rem',
    fontWeight: '800',
    letterSpacing: '0.04em'
  },
  dashboardGrid: {
    display: 'flex',
    flex: 1,
    padding: '20px',
    gap: '24px',
    maxWidth: '1600px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    flexWrap: 'wrap'
  },
  leftColumn: {
    flex: '0 1 48%',
    minWidth: '340px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  rightColumn: {
    flex: '1 1 50%',
    minWidth: '360px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid #1e293b'
  },
  columnIcon: {
    fontSize: '1.1rem'
  },
  columnTitle: {
    margin: 0,
    fontSize: '0.88rem',
    fontWeight: '700',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  componentWrapper: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%'
  }
}
