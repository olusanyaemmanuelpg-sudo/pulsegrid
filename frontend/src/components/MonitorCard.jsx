import React, { useState } from 'react';
import {
  Globe,
  Database,
  Server,
  Clock,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from './Icons';
import { useMonitors } from '../context/MonitorContext';
import { useAuth } from '../context/AuthContext';

const getPublicApiBaseUrl = () => {
  const configured = (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    ''
  ).replace(/\/+$/, '');

  if (configured && /^https?:\/\//i.test(configured)) {
    return configured;
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost:3000';
};

export const MonitorCard = ({ monitor }) => {
  const { user } = useAuth();
  const { deleteMonitor, testMonitor, toggleVisibility } = useMonitors();
  const [testing, setTesting] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [copiedHeartbeat, setCopiedHeartbeat] = useState(false);

  const isPublic = Boolean(monitor.is_public ?? monitor.isPublic);

  const handleTest = async () => {
    setTesting(true);
    try {
      await testMonitor(monitor.id);
    } finally {
      setTesting(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (togglingVisibility || !toggleVisibility) return;
    setTogglingVisibility(true);
    try {
      await toggleVisibility(monitor.id, !isPublic);
    } catch (err) {
      console.error('Failed to toggle visibility:', err.message);
    } finally {
      setTogglingVisibility(false);
    }
  };

  const getHeartbeatUrl = () => {
    const base = getPublicApiBaseUrl();
    const token = monitor.heartbeat_secret;
    return token
      ? `${base}/api/heartbeat/${monitor.id}?token=${token}`
      : `${base}/api/heartbeat/${monitor.id}`;
  };

  const getHeartbeatCommand = () => {
    return `curl -fsS "${getHeartbeatUrl()}"`;
  };

  const handleCopyHeartbeat = () => {
    const command = getHeartbeatCommand();
    navigator.clipboard.writeText(command);
    setCopiedHeartbeat(true);
    setTimeout(() => setCopiedHeartbeat(false), 2000);
  };

  const getIcon = () => {
    switch (monitor.type) {
      case 'postgres':
      case 'mysql':
        return <Database size={18} className="type-icon postgres" />;
      case 'redis':
        return <Server size={18} className="type-icon redis" />;
      case 'cron':
        return <Clock size={18} className="type-icon cron" />;
      default:
        return <Globe size={18} className="type-icon http" />;
    }
  };

  const isUp = monitor.status === 'up';

  // Calculate real 30-slot check timeline (starts from left, fills towards right)
  const recentChecks = monitor.recentChecks || [];
  const totalSlots = 30;
  const emptyCount = Math.max(0, totalSlots - recentChecks.length);
  const slots = [
    ...recentChecks.map((c) => ({ type: 'check', ...c })),
    ...Array(emptyCount).fill({ type: 'empty' }),
  ];

  const checkCount = recentChecks.length;
  const upCount = recentChecks.filter((c) => c.status === 'up').length;
  const successPercentage =
    checkCount > 0 ? Math.round((upCount / checkCount) * 100) : 100;
  const successLabel =
    checkCount === 0
      ? 'Awaiting checks'
      : `${successPercentage}% success (${upCount}/${checkCount})`;

  return (
    <div className={`monitor-card ${isUp ? 'is-up' : 'is-down'}`}>
      {/* Top Header */}
      <div className="card-top">
        <div className="card-title-group">
          <div className="card-icon-wrap">{getIcon()}</div>
          <div>
            <div className="card-title-row">
              <h3 className="card-name">{monitor.name}</h3>
              <span className={`status-tag ${isUp ? 'up' : 'down'}`}>
                <span className="dot-indicator"></span>
                {isUp ? 'Operational' : 'Down'}
              </span>
              {user?.role === 'admin' && (
                <button
                  type="button"
                  className="btn-status-toggle"
                  onClick={handleToggleVisibility}
                  disabled={togglingVisibility}
                  title={
                    isPublic
                      ? 'Published on Public Status Page (Click to make private)'
                      : 'Private to workspace (Click to publish on status page)'
                  }
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    border: isPublic
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                    background: isPublic
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: isPublic ? '#10b981' : 'var(--text-muted, #a1a1aa)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {togglingVisibility
                    ? '...'
                    : isPublic
                      ? '🌐 Public'
                      : '🔒 Private'}
                </button>
              )}
            </div>
            <p
              className="card-target"
              title={
                monitor.type === 'cron' ? 'Heartbeat monitor' : monitor.target
              }
            >
              {monitor.type === 'cron' ? 'Heartbeat monitor' : monitor.target}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="card-actions">
          <button
            className={`btn-icon ${testing ? 'spinning' : ''}`}
            onClick={handleTest}
            title="Ping / Test Monitor Now"
            disabled={testing}
          >
            <RefreshCw size={15} />
          </button>
          <button
            className="btn-icon danger"
            onClick={() => deleteMonitor(monitor.id)}
            title="Delete Monitor"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Outage alert banner if down */}
      {!isUp && (
        <div className="card-outage-alert">
          <AlertTriangle size={15} />
          <span>
            {monitor.error ||
              'Outage detected across worker verification nodes.'}
          </span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="card-metrics-grid">
        <div className="metric-box">
          <span className="metric-label">Latency</span>
          <span className="metric-val">
            {isUp ? `${monitor.latency} ms` : '—'}
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-label">90-Day Uptime</span>
          <span className="metric-val text-green">{monitor.uptime90d}%</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Check Interval</span>
          <span className="metric-val">
            {monitor.interval >= 86400
              ? '24h'
              : monitor.interval >= 3600
                ? '1h'
                : `${monitor.interval}s`}
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Last Ping</span>
          <span className="metric-val text-muted">{monitor.lastChecked}</span>
        </div>
      </div>

      {/* Visual Uptime Bar (Accurate Check History Timeline) */}
      <div className="uptime-strip-container">
        <div className="uptime-strip-header">
          <span className="strip-title">
            Recent Check History (Last 30 probes)
          </span>
          <span
            className={`strip-stat font-mono ${successPercentage < 100 && checkCount > 0 ? 'text-red' : ''}`}
          >
            {successLabel}
          </span>
        </div>
        <div className="uptime-bars">
          {slots.map((slot, idx) => {
            if (slot.type === 'empty') {
              return (
                <div
                  key={idx}
                  className="uptime-bar-slice empty"
                  title="No check logged in this slot yet"
                />
              );
            }
            const isPass = slot.status === 'up';
            const time = slot.created_at
              ? new Date(slot.created_at).toLocaleTimeString()
              : '';
            const tooltip = `${time}: ${isPass ? 'Operational' : 'Outage'} (${slot.latency_ms ?? 0}ms)${slot.error ? ' - ' + slot.error : ''}`;
            return (
              <div
                key={slot.id || idx}
                className={`uptime-bar-slice ${isPass ? 'pass' : 'fail'}`}
                title={tooltip}
              />
            );
          })}
        </div>
      </div>

      {/* Cron Heartbeat helper command if type is cron */}
      {monitor.type === 'cron' && (
        <div className="card-cron-snippet">
          <span className="cron-snippet-label">Heartbeat Ping URL:</span>
          <div className="cron-snippet-cmd">
            <code>{getHeartbeatCommand()}</code>
            <button
              type="button"
              className="btn-copy-mini"
              onClick={handleCopyHeartbeat}
              title="Copy heartbeat command"
            >
              {copiedHeartbeat ? '✓ Copied' : 'Copy Command'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
