import React from 'react';
import { useMonitors } from '../context/MonitorContext';
import { CheckCircle, AlertTriangle, Globe, Database, Server, Clock, Shield } from '../components/Icons';

export const StatusPage = () => {
  const { monitors, metrics } = useMonitors();
  const isOperational = metrics.down === 0;

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

  return (
    <div className="status-page-container">
      {/* Top Banner */}
      <div className={`status-hero-banner ${isOperational ? 'operational' : 'degraded'}`}>
        <div className="banner-icon-wrap">
          {isOperational ? (
            <CheckCircle size={28} className="text-green" />
          ) : (
            <AlertTriangle size={28} className="text-red" />
          )}
        </div>
        <div>
          <h1 className="banner-title">
            {isOperational ? 'All Systems Fully Operational' : 'Partial Service Degradation Detected'}
          </h1>
          <p className="banner-sub">
            Verified across 3 distributed worker consensus regions • Real-time telemetry
          </p>
        </div>
      </div>

      {/* Services List Section */}
      <div className="status-section">
        <div className="status-section-header">
          <h2>Core Services & Infrastructure</h2>
          <span className="uptime-pill">90-Day Uptime: {metrics.uptime}%</span>
        </div>

        <div className="status-services-list">
          {monitors.map((mon) => {
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

                {/* 30-Day mini bar chart */}
                <div className="status-history-bars">
                  {Array.from({ length: 30 }).map((_, idx) => {
                    const isFailing = !isUp && idx >= 28;
                    return (
                      <div
                        key={idx}
                        className={`status-bar ${isFailing ? 'bar-fail' : 'bar-pass'}`}
                        title={`Day ${30 - idx}: ${isFailing ? 'Downtime logged' : '100% Uptime'}`}
                      />
                    );
                  })}
                </div>

                <div className="service-stat-end">
                  <span className="service-uptime">{mon.uptime90d}%</span>
                  <span className="service-latency">{isUp ? `${mon.latency}ms` : 'Down'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Past Incidents Log */}
      <div className="status-section mt-8">
        <h2 className="mb-4">Recent Incident History</h2>

        <div className="incidents-timeline">
          {metrics.down > 0 && (
            <div className="incident-card active-incident">
              <div className="incident-header">
                <div className="incident-tag red">Active Incident</div>
                <span className="incident-time">Detected 5m ago</span>
              </div>
              <h3 className="incident-title">Netlify CDN Edge 502 Bad Gateway</h3>
              <p className="incident-body">
                Our worker consensus nodes detected connection drops to the static landing page.
                Root cause identified as CDN bandwidth quota limits. Automatic failover retry queue is active.
              </p>
            </div>
          )}

          <div className="incident-card">
            <div className="incident-header">
              <div className="incident-tag green">Resolved</div>
              <span className="incident-time">2 days ago</span>
            </div>
            <h3 className="incident-title">Scheduled PostgreSQL Connection Pool Maintenance</h3>
            <p className="incident-body">
              Primary cluster connection pool was scaled from 100 to 250 connections.
              Zero dropped queries recorded during live traffic transition.
            </p>
          </div>

          <div className="incident-card">
            <div className="incident-header">
              <div className="incident-tag green">Resolved</div>
              <span className="incident-time">1 week ago</span>
            </div>
            <h3 className="incident-title">Redis Cluster Resharding Completed</h3>
            <p className="incident-body">
              Consistent hash ring updated to add 2 new worker partitions. All background heartbeats
              rebalanced seamlessly without packet loss.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
