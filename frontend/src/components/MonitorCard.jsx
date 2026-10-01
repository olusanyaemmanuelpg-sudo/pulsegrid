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

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

export const MonitorCard = ({ monitor }) => {
  const { deleteMonitor, testMonitor } = useMonitors();
  const [testing, setTesting] = useState(false);
  const [copiedHeartbeat, setCopiedHeartbeat] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      await testMonitor(monitor.id);
    } finally {
      setTesting(false);
    }
  };

  const handleCopyHeartbeat = () => {
    const heartbeatToken = monitor.heartbeat_secret;
    const command = heartbeatToken
      ? `curl -fsS "${API_BASE_URL}/api/heartbeat/${monitor.id}?token=${heartbeatToken}"`
      : `curl -fsS ${API_BASE_URL}/api/heartbeat/${monitor.id}`;

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
            </div>
            <p className="card-target" title={monitor.target}>
              {monitor.target}
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
            <code>
              {monitor.heartbeat_secret
                ? `curl -fsS "${API_BASE_URL}/api/heartbeat/${monitor.id}?token=${monitor.heartbeat_secret}"`
                : `curl -fsS ${API_BASE_URL}/api/heartbeat/${monitor.id}`}
            </code>
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
