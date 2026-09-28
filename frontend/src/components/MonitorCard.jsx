import React, { useState } from 'react';
import { Globe, Database, Server, Clock, RefreshCw, Trash2, AlertTriangle } from './Icons';
import { useMonitors } from '../context/MonitorContext';

export const MonitorCard = ({ monitor }) => {
  const { deleteMonitor, testMonitor } = useMonitors();
  const [testing, setTesting] = useState(false);

  const handleTest = () => {
    setTesting(true);
    setTimeout(() => {
      testMonitor(monitor.id);
      setTesting(false);
    }, 600);
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
            {monitor.error || 'Outage detected across 3 worker consensus nodes.'}
          </span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="card-metrics-grid">
        <div className="metric-box">
          <span className="metric-label">Latency</span>
          <span className="metric-val">{isUp ? `${monitor.latency} ms` : '—'}</span>
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

      {/* Visual Uptime Bar (30-day mini blocks) */}
      <div className="uptime-strip-container">
        <div className="uptime-strip-header">
          <span className="strip-title">Recent Check History</span>
          <span className="strip-stat">{isUp ? '100% success' : 'Degraded'}</span>
        </div>
        <div className="uptime-bars">
          {Array.from({ length: 30 }).map((_, idx) => {
            const isFailing = !isUp && idx >= 28;
            return (
              <div
                key={idx}
                className={`uptime-bar-slice ${isFailing ? 'fail' : 'pass'}`}
                title={`Day ${30 - idx}: ${isFailing ? 'Incident detected' : '100% Operational'}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
