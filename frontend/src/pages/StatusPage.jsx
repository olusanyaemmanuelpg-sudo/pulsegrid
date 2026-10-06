import React, { useEffect, useState } from 'react';
import { useMonitors } from '../context/MonitorContext';
import {
  CheckCircle,
  AlertTriangle,
  Globe,
  Database,
  Server,
  Clock,
  RefreshCw,
  Megaphone,
  Radio,
} from '../components/Icons';

export const StatusPage = () => {
  const {
    publicMonitors,
    monitors,
    systemStatus,
    incidents,
    fetchPublicStatus,
  } = useMonitors();

  const [refreshing, setRefreshing] = useState(false);

  // Always ensure fresh public status is loaded on mount
  useEffect(() => {
    fetchPublicStatus();
  }, [fetchPublicStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPublicStatus();
    setRefreshing(false);
  };

  // Determine active services to display (PulseGrid core platform services; user monitors remain private)
  const displayServices = publicMonitors;

  const effectiveStatus = systemStatus?.effectiveStatus || 'operational';
  const announcement = systemStatus?.announcement || {};
  const activeIncidents = incidents?.active || [];
  const recentIncidents = incidents?.recent || [];

  const getStatusBannerDetails = () => {
    switch (effectiveStatus) {
      case 'maintenance':
        return {
          title: 'Scheduled Maintenance in Progress',
          subtitle: 'Core systems are currently undergoing planned maintenance or upgrades.',
          icon: <Clock size={28} style={{ color: '#a78bfa' }} />,
          className: 'maintenance',
          tag: 'Maintenance',
        };
      case 'major_outage':
        return {
          title: 'Major System Outage',
          subtitle: 'Critical infrastructure disruptions detected across core services.',
          icon: <AlertTriangle size={28} className="text-red" />,
          className: 'degraded',
          tag: 'Major Outage',
        };
      case 'partial_outage':
      case 'degraded':
        return {
          title: 'Partial Service Degradation Detected',
          subtitle: 'Some services or dependent nodes are experiencing elevated latency or outages.',
          icon: <AlertTriangle size={28} className="text-red" />,
          className: 'degraded',
          tag: 'Degraded',
        };
      case 'operational':
      default:
        return {
          title: 'All Systems Fully Operational',
          subtitle: 'Verified across distributed worker consensus regions • Real-time telemetry',
          icon: <CheckCircle size={28} className="text-green" />,
          className: 'operational',
          tag: 'Operational',
        };
    }
  };

  const bannerDetails = getStatusBannerDetails();

  const getIcon = (type) => {
    switch (type) {
      case 'postgres':
      case 'mysql':
        return <Database size={16} className="text-blue" />;
      case 'redis':
        return <Server size={16} className="text-yellow" />;
      case 'cron':
        return <Clock size={16} className="text-purple" />;
      default:
        return <Globe size={16} className="text-green" />;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  return (
    <div className="status-page-container">
      {/* Platform Announcement Banner (if activated by Admin) */}
      {announcement.active && (
        <div
          className={`status-announcement-banner level-${announcement.level || 'info'}`}
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
            background:
              announcement.level === 'critical'
                ? 'rgba(239, 68, 68, 0.15)'
                : announcement.level === 'warning'
                ? 'rgba(245, 158, 11, 0.15)'
                : announcement.level === 'maintenance'
                ? 'rgba(139, 92, 246, 0.15)'
                : 'rgba(59, 130, 246, 0.15)',
            border:
              announcement.level === 'critical'
                ? '1px solid rgba(239, 68, 68, 0.35)'
                : announcement.level === 'warning'
                ? '1px solid rgba(245, 158, 11, 0.35)'
                : announcement.level === 'maintenance'
                ? '1px solid rgba(139, 92, 246, 0.35)'
                : '1px solid rgba(59, 130, 246, 0.35)',
          }}
        >
          <div style={{ marginTop: '2px', color: 'currentColor' }}>
            <Megaphone size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.1)',
                }}
              >
                {announcement.level || 'Announcement'}
              </span>
              <strong style={{ fontSize: '0.95rem' }}>{announcement.title}</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.9, lineHeight: 1.5 }}>
              {announcement.message}
            </p>
          </div>
        </div>
      )}

      {/* Top Hero Banner */}
      <div className={`status-hero-banner ${bannerDetails.className}`}>
        <div className="banner-icon-wrap">{bannerDetails.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h1 className="banner-title">{bannerDetails.title}</h1>
            <button
              onClick={handleRefresh}
              className="btn-secondary"
              title="Refresh live status"
              style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <RefreshCw size={13} className={refreshing ? 'spin-anim' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
          <p className="banner-sub">{bannerDetails.subtitle}</p>
        </div>
      </div>

      {/* Active Incidents Section (if any ongoing incidents) */}
      {activeIncidents.length > 0 && (
        <div className="status-section" style={{ marginBottom: '2rem' }}>
          <div className="status-section-header" style={{ marginBottom: '1rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
              <AlertTriangle size={18} />
              <span>Ongoing System Incidents</span>
            </h2>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                padding: '3px 10px',
                borderRadius: '12px',
              }}
            >
              {activeIncidents.length} Active
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activeIncidents.map((inc) => (
              <div
                key={inc.id}
                style={{
                  background: 'var(--bg-card, #18181b)',
                  borderRadius: '12px',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background:
                          inc.status === 'investigating'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : inc.status === 'identified'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(59, 130, 246, 0.15)',
                        color:
                          inc.status === 'investigating'
                            ? '#ef4444'
                            : inc.status === 'identified'
                            ? '#f59e0b'
                            : '#60a5fa',
                      }}
                    >
                      {inc.status}
                    </span>
                    <strong style={{ fontSize: '1rem' }}>{inc.title}</strong>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #71717a)' }}>
                    {formatDateTime(inc.created_at)}
                  </span>
                </div>

                {inc.impacted_components && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #a1a1aa)', marginBottom: '0.6rem' }}>
                    <strong>Impacted:</strong> {inc.impacted_components}
                  </div>
                )}

                <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text-secondary, #d4d4d8)' }}>
                  {inc.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Core Services List Section */}
      <div className="status-section">
        <div className="status-section-header">
          <h2>Core Services & Infrastructure</h2>
          <span className="uptime-pill">
            <Radio size={12} style={{ color: '#10b981', marginRight: '4px' }} />
            Consensus Monitored
          </span>
        </div>

        <div className="status-services-list">
          {displayServices.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted, #71717a)' }}>
              No public services are currently configured on the status page.
            </div>
          ) : (
            displayServices.map((mon) => {
              const isUp = mon.status === 'up';
              return (
                <div key={mon.id} className="status-service-row">
                  <div className="service-info">
                    <div className="service-name-row">
                      {getIcon(mon.type)}
                      <span className="service-title">{mon.name}</span>
                    </div>
                    <span className={`service-status-tag ${isUp ? 'up' : 'down'}`}>
                      {isUp ? 'Operational' : 'Degraded'}
                    </span>
                  </div>

                  {/* Real 30-Check History Timeline */}
                  <div className="status-history-bars">
                    {(() => {
                      const recentChecks = mon.recentChecks || [];
                      const emptyCount = Math.max(0, 30 - recentChecks.length);
                      const slots = [
                        ...recentChecks.map((c) => ({ type: 'check', ...c })),
                        ...Array(emptyCount).fill({ type: 'empty' }),
                      ];
                      return slots.map((slot, idx) => {
                        if (slot.type === 'empty') {
                          return (
                            <div
                              key={idx}
                              className="status-bar bar-empty"
                              title="No check logged yet"
                            />
                          );
                        }
                        const isPass = slot.status === 'up';
                        const time = slot.created_at
                          ? new Date(slot.created_at).toLocaleTimeString()
                          : '';
                        return (
                          <div
                            key={slot.id || idx}
                            className={`status-bar ${isPass ? 'bar-pass' : 'bar-fail'}`}
                            title={`${time}: ${isPass ? 'Operational' : 'Outage'} (${slot.latency_ms ?? 0}ms)`}
                          />
                        );
                      });
                    })()}
                  </div>

                  <div className="service-stat-end">
                    <span className="service-uptime">{mon.uptime90d}%</span>
                    <span className="service-latency">{isUp ? `${mon.latency}ms` : 'Down'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Past Incidents Log */}
      <div className="status-section mt-8">
        <h2 className="mb-4">Recent Incident History</h2>

        <div className="incidents-timeline">
          {recentIncidents.length > 0 ? (
            recentIncidents.map((inc) => (
              <div key={inc.id} className="incident-card">
                <div className="incident-header">
                  <div className="incident-tag green">Resolved</div>
                  <span className="incident-time">
                    {inc.resolved_at ? formatDateTime(inc.resolved_at) : formatDateTime(inc.created_at)}
                  </span>
                </div>
                <h3 className="incident-title">{inc.title}</h3>
                {inc.impacted_components && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #71717a)', marginBottom: '0.4rem' }}>
                    Components: {inc.impacted_components}
                  </div>
                )}
                <p className="incident-body">{inc.message}</p>
              </div>
            ))
          ) : (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                background: 'var(--bg-card, #18181b)',
                borderRadius: '10px',
                color: 'var(--text-muted, #71717a)',
                fontSize: '0.9rem',
              }}
            >
              No incidents reported in the last 14 days. 100% operational efficiency.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusPage;
