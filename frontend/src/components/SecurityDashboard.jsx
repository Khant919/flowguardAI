import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client for Vite frontend
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fzjjftmhxncgwwyynemo.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kcVG89q4_M37pfi_QgTKOw_zuR2ns2O';

const supabase = createClient(supabaseUrl, supabaseKey);

export default function SecurityDashboard() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [recentAlertActive, setRecentAlertActive] = useState(false);

  // 1. Initial Load & Real-Time WebSocket Subscription
  useEffect(() => {
    let isMounted = true;

    // Fetch initial last 10 records
    async function fetchInitialEvents() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;
        if (isMounted && data) {
          setEvents(data);
        }
      } catch (err) {
        console.error('Failed to fetch security events:', err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchInitialEvents();

    // 2. Real-Time Subscription to `events` table
    const channel = supabase
      .channel('events-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        (payload) => {
          const newEvent = payload.new;
          console.log('⚡ [SOC Dashboard] Realtime incident received:', newEvent);

          setEvents((prev) => [newEvent, ...prev.slice(0, 19)]); // Keep top 20
          setRecentAlertActive(true);

          // Reset alert indicator after 6 seconds
          setTimeout(() => {
            if (isMounted) setRecentAlertActive(false);
          }, 6000);
        }
      )
      .subscribe((status) => {
        console.log('📡 [SOC Realtime Channel Status]:', status);
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Computed KPI Metrics
  const metrics = useMemo(() => {
    const totalToday = events.length;
    const checkpoints = new Set(events.map((e) => e.camera_id)).size || 1;

    const avgConfidence = events.length
      ? Math.round(
          (events.reduce((acc, e) => acc + (parseFloat(e.confidence_score) || 0.95), 0) /
            events.length) *
            100
        )
      : 95;

    return {
      totalToday,
      activeCheckpoints: `${checkpoints} Active`,
      avgConfidence: `${avgConfidence}%`,
      status: recentAlertActive ? 'ELEVATED' : 'SECURE'
    };
  }, [events, recentAlertActive]);

  return (
    <div style={styles.container}>
      {/* Dashboard Header */}
      <div style={styles.header}>
        <div style={styles.titleArea}>
          <div style={styles.pulseDot}></div>
          <h3 style={styles.title}>SOC Live Security Operations Feed</h3>
        </div>
        <span style={styles.liveBadge}>● LIVE STREAM</span>
      </div>

      {/* KPI Metrics Bar */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Total Incidents Logged</span>
          <span style={styles.metricValue}>{metrics.totalToday}</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Active Checkpoints</span>
          <span style={styles.metricValue}>Gate_04_Demo</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Avg AI Confidence</span>
          <span style={{ ...styles.metricValue, color: '#38bdf8' }}>
            {metrics.avgConfidence}
          </span>
        </div>
        <div
          style={{
            ...styles.metricCard,
            borderColor: metrics.status === 'ELEVATED' ? '#ef4444' : '#10b981',
            backgroundColor:
              metrics.status === 'ELEVATED'
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(16, 185, 129, 0.1)'
          }}
        >
          <span style={styles.metricLabel}>System Threat Level</span>
          <span
            style={{
              ...styles.metricValue,
              color: metrics.status === 'ELEVATED' ? '#f87171' : '#34d399'
            }}
          >
            {metrics.status}
          </span>
        </div>
      </div>

      {/* Live Incident Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeadRow}>
              <th style={styles.th}>TIME</th>
              <th style={styles.th}>CHECKPOINT</th>
              <th style={styles.th}>ANOMALY TYPE</th>
              <th style={styles.th}>CONFIDENCE</th>
              <th style={styles.th}>EVIDENCE</th>
              <th style={styles.th}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" style={styles.loadingCell}>
                  ⏳ Connecting to Supabase Realtime Security Feed...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan="6" style={styles.emptyCell}>
                  ✅ No anomalies detected yet. System secure.
                </td>
              </tr>
            ) : (
              events.map((evt, idx) => {
                const isNewest = idx === 0 && recentAlertActive;
                const formattedTime = new Date(evt.timestamp || evt.created_at).toLocaleTimeString();

                return (
                  <tr
                    key={evt.id || idx}
                    style={{
                      ...styles.tableRow,
                      backgroundColor: isNewest ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                      transition: 'background-color 0.5s ease'
                    }}
                  >
                    <td style={{ ...styles.td, fontFamily: 'monospace' }}>
                      {formattedTime}
                    </td>
                    <td style={{ ...styles.td, fontWeight: '600', color: '#e2e8f0' }}>
                      {evt.camera_id}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.anomalyBadge}>
                        {evt.anomaly_type || 'tailgating'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, color: '#38bdf8', fontWeight: '600' }}>
                      {Math.round((parseFloat(evt.confidence_score) || 0.95) * 100)}%
                    </td>
                    <td style={styles.td}>
                      {evt.snapshot_url ? (
                        <img
                          src={evt.snapshot_url}
                          alt="Snapshot"
                          style={styles.thumbnail}
                          onClick={() => setSelectedSnapshot(evt)}
                          title="Click to enlarge evidence"
                        />
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>No image</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.dispatchedBadge}>DISPATCHED</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Snapshot Enlarge Modal */}
      {selectedSnapshot && (
        <div style={styles.modalOverlay} onClick={() => setSelectedSnapshot(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h4 style={{ margin: 0, color: '#f8fafc' }}>
                📸 Security Evidence Snapshot — {selectedSnapshot.camera_id}
              </h4>
              <button
                style={styles.closeBtn}
                onClick={() => setSelectedSnapshot(null)}
              >
                ✕
              </button>
            </div>
            <img
              src={selectedSnapshot.snapshot_url}
              alt="Full Evidence"
              style={styles.fullImage}
            />
            <div style={styles.modalFooter}>
              <span>
                <strong>Timestamp:</strong>{' '}
                {new Date(
                  selectedSnapshot.timestamp || selectedSnapshot.created_at
                ).toLocaleString()}
              </span>
              <span>
                <strong>AI Confidence:</strong>{' '}
                {Math.round(
                  (parseFloat(selectedSnapshot.confidence_score) || 0.95) * 100
                )}
                %
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Modern Dark Theme Styles for SOC Dashboard
const styles = {
  container: {
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
  titleArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  pulseDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#10b981',
    borderRadius: '50%',
    boxShadow: '0 0 8px #10b981'
  },
  title: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: '-0.01em'
  },
  liveBadge: {
    fontSize: '0.7rem',
    fontWeight: '700',
    color: '#34d399',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: '3px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(16, 185, 129, 0.3)'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '10px',
    padding: '14px',
    backgroundColor: '#0f172a'
  },
  metricCard: {
    backgroundColor: '#1e293b',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  metricLabel: {
    fontSize: '0.65rem',
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  metricValue: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#f8fafc'
  },
  tableWrapper: {
    overflowX: 'auto',
    borderTop: '1px solid #334155'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.8rem'
  },
  tableHeadRow: {
    backgroundColor: '#1e293b'
  },
  th: {
    padding: '10px 12px',
    color: '#94a3b8',
    fontSize: '0.68rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    borderBottom: '1px solid #334155'
  },
  tableRow: {
    borderBottom: '1px solid #1e293b'
  },
  td: {
    padding: '10px 12px',
    color: '#cbd5e1',
    verticalAlign: 'middle'
  },
  loadingCell: {
    padding: '24px',
    textAlign: 'center',
    color: '#94a3b8'
  },
  emptyCell: {
    padding: '24px',
    textAlign: 'center',
    color: '#64748b'
  },
  anomalyBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.72rem',
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  dispatchedBadge: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    color: '#38bdf8',
    border: '1px solid rgba(2, 132, 199, 0.4)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.68rem',
    fontWeight: '700'
  },
  thumbnail: {
    width: '42px',
    height: '32px',
    borderRadius: '4px',
    objectFit: 'cover',
    cursor: 'pointer',
    border: '1px solid #475569',
    transition: 'transform 0.2s ease'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: '16px'
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #475569',
    maxWidth: '600px',
    width: '100%',
    overflow: 'hidden'
  },
  modalHeader: {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #334155'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '1.2rem',
    cursor: 'pointer'
  },
  fullImage: {
    width: '100%',
    display: 'block',
    maxHeight: '400px',
    objectFit: 'contain',
    backgroundColor: '#000000'
  },
  modalFooter: {
    padding: '12px 16px',
    backgroundColor: '#0f172a',
    display: 'flex',
    justifyContent: 'space-between',
    color: '#cbd5e1',
    fontSize: '0.82rem'
  }
};
