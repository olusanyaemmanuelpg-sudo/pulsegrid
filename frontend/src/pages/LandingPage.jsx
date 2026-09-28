import React, { useState } from 'react';
import { Link } from 'react-router';
import {
  Globe,
  Database,
  Server,
  Clock,
  Activity,
  Sparkles,
  Check,
} from '../components/Icons';
import { useAuth } from '../context/AuthContext';

export const LandingPage = () => {
  const [activeTab, setActiveTab] = useState('http');
  const { user } = useAuth();
  const startLink = user ? '/dashboard' : '/login?mode=signup';

  return (
    <div className="landing-container">
      {/* 1. HERO SECTION */}
      <section className="hero-section">
        <div className="hero-badge">
          <Sparkles size={14} className="text-green" />
          <span>Uptime visibility for the services behind your product</span>
        </div>

        <h1 className="hero-title">
          Know when something breaks.
          <br />
          <span className="gradient-text">See what needs attention.</span>
        </h1>

        <p className="hero-subtitle">
          Keep an eye on websites, APIs, databases, caches, and scheduled jobs
          from one clear, practical workspace.
        </p>

        <div className="hero-actions">
          <Link to={startLink} className="btn-primary-large">
            {user ? 'Open dashboard' : 'Create your account'}
          </Link>
          <Link to="/status" className="btn-secondary-large">
            View status page
          </Link>
          <span className="hero-caption">
            Start with one check. Add more as you grow.
          </span>
        </div>

        {/* Product preview */}
        <div className="hero-preview-box">
          <div className="preview-top-bar">
            <div className="window-dots">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <span className="preview-bar-title">
              Workspace preview · Example monitor data
            </span>
          </div>

          <div className="preview-content">
            <div className="preview-item">
              <div className="preview-item-left">
                <Globe size={18} className="text-green" />
                <div>
                  <strong>Production API</strong>
                  <span className="preview-sub">
                    HTTP endpoint · Checked just now
                  </span>
                </div>
              </div>
              <div className="preview-item-right">
                <span className="metric-chip green">84 ms</span>
                <span className="status-badge-green">OPERATIONAL</span>
              </div>
            </div>

            <div className="preview-item">
              <div className="preview-item-left">
                <Database size={18} className="text-blue" />
                <div>
                  <strong>Primary database</strong>
                  <span className="preview-sub">
                    PostgreSQL · Connection check
                  </span>
                </div>
              </div>
              <div className="preview-item-right">
                <span className="metric-chip green">18 ms</span>
                <span className="status-badge-green">OPERATIONAL</span>
              </div>
            </div>

            <div className="preview-item">
              <div className="preview-item-left">
                <Clock size={18} className="text-purple" />
                <div>
                  <strong>Nightly backup</strong>
                  <span className="preview-sub">
                    Scheduled job · Heartbeat monitor
                  </span>
                </div>
              </div>
              <div className="preview-item-right">
                <span className="metric-chip yellow">Daily</span>
                <span className="status-badge-green">OPERATIONAL</span>
              </div>
            </div>
          </div>
          <p className="preview-disclaimer">
            Illustrative preview. Your workspace uses your own monitor data.
          </p>
        </div>
      </section>

      {/* Supported monitor types */}
      <section className="partners-strip">
        <p className="partners-label">ONE WORKSPACE FOR YOUR SERVICE CHECKS</p>
        <div className="partners-logos">
          <span className="partner-logo">Websites & APIs</span>
          <span className="partner-logo">PostgreSQL</span>
          <span className="partner-logo">MySQL</span>
          <span className="partner-logo">Redis</span>
          <span className="partner-logo">Scheduled jobs</span>
        </div>
      </section>

      {/* Monitoring workflow */}
      <section className="arch-section">
        <div className="arch-header">
          <span className="arch-pill">One monitoring workspace</span>
          <h2 className="section-title">A clear picture of service health.</h2>
          <p className="section-subtitle">
            Follow the checks that matter to your team and review service
            status, response time, and recent history together.
          </p>
        </div>

        <div className="arch-diagram-grid">
          <div className="arch-card">
            <div className="arch-step-badge">01</div>
            <h3>Check endpoints</h3>
            <p>
              Track websites and APIs with response status, latency, and recent
              check history.
            </p>
          </div>
          <div className="arch-card">
            <div className="arch-step-badge">02</div>
            <h3>Watch dependencies</h3>
            <p>
              Keep database and Redis health alongside the services that depend
              on them.
            </p>
          </div>
          <div className="arch-card">
            <div className="arch-step-badge">03</div>
            <h3>Track scheduled work</h3>
            <p>
              Use cron heartbeats to make missed background jobs easier to
              investigate.
            </p>
          </div>
        </div>
      </section>

      {/* Multi-protocol overview */}
      <section className="interactive-tabs-section">
        <div className="text-center mb-6">
          <h2 className="section-title">Checks that fit your stack.</h2>
          <p className="section-subtitle">
            Choose the monitor type that matches the service.
          </p>
        </div>

        <div className="tabs-nav">
          <button
            className={`tab-btn ${activeTab === 'http' ? 'active' : ''}`}
            onClick={() => setActiveTab('http')}
          >
            <Globe size={16} />
            <span>Web & REST APIs</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'db' ? 'active' : ''}`}
            onClick={() => setActiveTab('db')}
          >
            <Database size={16} />
            <span>PostgreSQL & MySQL</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'redis' ? 'active' : ''}`}
            onClick={() => setActiveTab('redis')}
          >
            <Server size={16} />
            <span>Redis</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'cron' ? 'active' : ''}`}
            onClick={() => setActiveTab('cron')}
          >
            <Clock size={16} />
            <span>Scheduled jobs</span>
          </button>
        </div>

        <div className="tab-showcase-box">
          {activeTab === 'http' && (
            <div className="tab-details">
              <h3>Website and API checks</h3>
              <p>
                Monitor an endpoint and review its status, response time, and
                recent check history.
              </p>
              <ul className="tab-checklist">
                <li>
                  <Check size={16} className="text-green" /> Monitor public URLs
                  and API endpoints
                </li>
                <li>
                  <Check size={16} className="text-green" /> See response status
                  and latency at a glance
                </li>
                <li>
                  <Check size={16} className="text-green" /> Review recent
                  checks in the dashboard
                </li>
              </ul>
            </div>
          )}
          {activeTab === 'db' && (
            <div className="tab-details">
              <h3>Database connection checks</h3>
              <p>
                Keep connection health for PostgreSQL and MySQL visible beside
                your application services.
              </p>
              <ul className="tab-checklist">
                <li>
                  <Check size={16} className="text-green" /> Add a database
                  monitor from the dashboard
                </li>
                <li>
                  <Check size={16} className="text-green" /> Review the current
                  state and response time
                </li>
                <li>
                  <Check size={16} className="text-green" /> Keep dependency
                  checks in one workspace
                </li>
              </ul>
            </div>
          )}
          {activeTab === 'redis' && (
            <div className="tab-details">
              <h3>Redis service checks</h3>
              <p>
                Include your cache in the same health overview as your API and
                database checks.
              </p>
              <ul className="tab-checklist">
                <li>
                  <Check size={16} className="text-green" /> Keep cache status
                  visible with other dependencies
                </li>
                <li>
                  <Check size={16} className="text-green" /> See the latest
                  check and latency
                </li>
                <li>
                  <Check size={16} className="text-green" /> Filter monitors by
                  service type
                </li>
              </ul>
            </div>
          )}
          {activeTab === 'cron' && (
            <div className="tab-details">
              <h3>Scheduled job heartbeats</h3>
              <p>
                Use a heartbeat monitor to see whether a scheduled task has
                checked in as expected.
              </p>
              <ul className="tab-checklist">
                <li>
                  <Check size={16} className="text-green" /> Create a monitor
                  for a recurring task
                </li>
                <li>
                  <Check size={16} className="text-green" /> Set an interval
                  that fits your schedule
                </li>
                <li>
                  <Check size={16} className="text-green" /> Review last
                  check-in from the monitor list
                </li>
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="cta-banner">
        <h2>Start with one service.</h2>
        <p>Set up a workspace and bring your first check into view.</p>
        <div className="cta-banner-buttons">
          <Link to={startLink} className="btn-primary-large">
            {user ? 'Open dashboard' : 'Create your account'}
          </Link>
          <Link to="/status" className="btn-secondary-large">
            View status page
          </Link>
        </div>
      </section>

      <footer className="footer-container">
        <div className="footer-left">
          <div className="brand-logo">
            <Activity size={18} className="text-green" />
            <span className="brand-name">
              Pulse<span className="brand-accent">Grid</span>
            </span>
          </div>
          <p className="footer-copy">
            A clearer view of the services behind your product.
          </p>
        </div>
        <div className="footer-links">
          <Link to={user ? '/dashboard' : '/login'}>
            {user ? 'Dashboard' : 'Sign in'}
          </Link>
          <Link to="/status">Status page</Link>
        </div>
      </footer>
    </div>
  );
};
