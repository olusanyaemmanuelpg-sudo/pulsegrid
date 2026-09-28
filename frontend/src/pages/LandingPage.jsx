import React from 'react';
import { Link } from 'react-router';
import { Globe, Database, Server, Clock, Shield, Zap, CheckCircle, Activity, Bell } from '../components/Icons';

export const LandingPage = ({ onOpenAddModal }) => {
  return (
    <div className="landing-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge">
          <span className="pulse-dot"></span>
          <span>Distributed Uptime & Health Engine</span>
        </div>

        <h1 className="hero-title">
          Zero-Downtime Monitoring for <br />
          <span className="gradient-text">Modern Infrastructure</span>
        </h1>

        <p className="hero-subtitle">
          Don't wait for users to report outages. Monitor HTTP endpoints, PostgreSQL, Redis,
          and background cron heartbeats across distributed worker rings with zero false alarms.
        </p>

        <div className="hero-actions">
          <Link to="/dashboard" className="btn-primary-large">
            Open Live Dashboard
          </Link>
          <button className="btn-secondary-large" onClick={onOpenAddModal}>
            + Add First Monitor
          </button>
        </div>

        {/* Live Preview Card */}
        <div className="hero-preview-box">
          <div className="preview-top-bar">
            <div className="window-dots">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <span className="preview-bar-title">pulsegrid-worker-ring // node-eu-1 // consensus: verified</span>
          </div>

          <div className="preview-content">
            <div className="preview-item">
              <div className="preview-item-left">
                <Globe size={18} className="text-green" />
                <div>
                  <strong>api.fintech.railway.app</strong>
                  <span className="preview-sub">HTTP 200 OK • Keyword: "healthy"</span>
                </div>
              </div>
              <div className="preview-item-right">
                <span className="metric-chip green">42 ms</span>
                <span className="status-badge-green">OPERATIONAL</span>
              </div>
            </div>

            <div className="preview-item">
              <div className="preview-item-left">
                <Database size={18} className="text-green" />
                <div>
                  <strong>PostgreSQL Primary Cluster</strong>
                  <span className="preview-sub">Wire Query: SELECT 1; • Pool: 14/100</span>
                </div>
              </div>
              <div className="preview-item-right">
                <span className="metric-chip green">18 ms</span>
                <span className="status-badge-green">OPERATIONAL</span>
              </div>
            </div>

            <div className="preview-item">
              <div className="preview-item-left">
                <Clock size={18} className="text-yellow" />
                <div>
                  <strong>Nightly DB Backup (Cron)</strong>
                  <span className="preview-sub">Heartbeat checked in 4h ago • Next due in 20h</span>
                </div>
              </div>
              <div className="preview-item-right">
                <span className="metric-chip yellow">Heartbeat Active</span>
                <span className="status-badge-green">HEALTHY</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="features-section">
        <h2 className="section-title">Engineered For Reliability</h2>
        <p className="section-subtitle">
          Everything you need to catch silent failures before they cost you users or revenue.
        </p>

        <div className="feature-cards-grid">
          <div className="feature-card">
            <div className="feature-icon-box green">
              <Globe size={24} />
            </div>
            <h3>Web & API Health</h3>
            <p>
              Sub-second HTTP checking, keyword assertion to catch hidden 502/503 errors, and automatic SSL certificate expiration warnings.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box blue">
              <Database size={24} />
            </div>
            <h3>Database & Cache Checks</h3>
            <p>
              Direct wire-protocol health checks for PostgreSQL, MySQL, and Redis (RESP PING). Catch connection pool exhaustion instantly.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box yellow">
              <Clock size={24} />
            </div>
            <h3>Dead Man's Switch</h3>
            <p>
              Inverted monitoring for cron jobs and background workers. Add one <code>curl</code> line to your script and know the moment it fails.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box purple">
              <Shield size={24} />
            </div>
            <h3>3-Strike Verification</h3>
            <p>
              Eliminates false alarms. A failure must be confirmed across 3 consecutive checks and verified by worker consensus before alerting.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box red">
              <Bell size={24} />
            </div>
            <h3>Instant Multi-Channel Alerts</h3>
            <p>
              Get alerts where you already hang out: free Telegram Bot alerts, Discord webhooks, Slack channels, and Email notifications.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box cyan">
              <Activity size={24} />
            </div>
            <h3>Public Status Pages</h3>
            <p>
              Out-of-the-box public status pages with 90-day uptime bars and incident reports to build trust with your users and clients.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
