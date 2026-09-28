import React, { useState } from 'react';
import { Link } from 'react-router';
import {
  Globe,
  Database,
  Server,
  Clock,
  Shield,
  Zap,
  CheckCircle,
  Activity,
  Bell,
  Sparkles,
  Github,
  Check,
  ExternalLink
} from '../components/Icons';

export const LandingPage = ({ onOpenAddModal }) => {
  const [activeTab, setActiveTab] = useState('http');

  return (
    <div className="landing-container">
      {/* 1. HERO SECTION */}
      <section className="hero-section">
        <div className="hero-badge">
          <Sparkles size={14} className="text-green" />
          <span>v1.0 Released • Open Source & Multi-Tenant SaaS</span>
        </div>

        <h1 className="hero-title">
          Zero-Downtime Monitoring for <br />
          <span className="gradient-text">Modern Engineering Teams</span>
        </h1>

        <p className="hero-subtitle">
          Don't wait for your users or customers to report outages. Continuous wire-level health
          checks for Web APIs, PostgreSQL, Redis, and background cron heartbeats across distributed
          worker rings with zero false alarms.
        </p>

        <div className="hero-actions">
          <Link to="/dashboard" className="btn-primary-large">
            Open Live Console
          </Link>
          <button className="btn-secondary-large" onClick={onOpenAddModal}>
            + Add First Monitor
          </button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-github-large"
          >
            <Github size={18} />
            <span>GitHub Repository</span>
          </a>
        </div>

        {/* Live Interactive Telemetry Box */}
        <div className="hero-preview-box">
          <div className="preview-top-bar">
            <div className="window-dots">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <span className="preview-bar-title">
              pulsegrid-worker-ring // node-us-east // consensus: 3/3 nodes OK
            </span>
          </div>

          <div className="preview-content">
            <div className="preview-item">
              <div className="preview-item-left">
                <Globe size={18} className="text-green" />
                <div>
                  <strong>api.fintech.railway.app/health</strong>
                  <span className="preview-sub">HTTP 200 OK • TLS Valid (84 days) • "status: ok"</span>
                </div>
              </div>
              <div className="preview-item-right">
                <span className="metric-chip green">38 ms</span>
                <span className="status-badge-green">OPERATIONAL</span>
              </div>
            </div>

            <div className="preview-item">
              <div className="preview-item-left">
                <Database size={18} className="text-blue" />
                <div>
                  <strong>Primary PostgreSQL Cluster</strong>
                  <span className="preview-sub">Wire Query: SELECT 1; • Pool Latency: 12ms</span>
                </div>
              </div>
              <div className="preview-item-right">
                <span className="metric-chip green">18 ms</span>
                <span className="status-badge-green">HEALTHY</span>
              </div>
            </div>

            <div className="preview-item">
              <div className="preview-item-left">
                <Clock size={18} className="text-purple" />
                <div>
                  <strong>Nightly DB Backup (Cron Dead-Man)</strong>
                  <span className="preview-sub">Last ping: 2h ago via curl • Next due in 22h</span>
                </div>
              </div>
              <div className="preview-item-right">
                <span className="metric-chip yellow">Active Heartbeat</span>
                <span className="status-badge-green">ONLINE</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PLATFORM LOGO STRIP */}
      <section className="partners-strip">
        <p className="partners-label">MONITOR INFRASTRUCTURE DEPLOYED ACROSS YOUR FAVORITE PLATFORMS</p>
        <div className="partners-logos">
          <span className="partner-logo">Railway</span>
          <span className="partner-logo">Render</span>
          <span className="partner-logo">Netlify</span>
          <span className="partner-logo">Vercel</span>
          <span className="partner-logo">Supabase</span>
          <span className="partner-logo">AWS</span>
          <span className="partner-logo">DigitalOcean</span>
        </div>
      </section>

      {/* 3. ARCHITECTURE VISUALIZATION (SYSTEM DESIGN HIGHLIGHT) */}
      <section className="arch-section">
        <div className="arch-header">
          <span className="arch-pill">Distributed Architecture</span>
          <h2 className="section-title">How PulseGrid Eliminates False Alarms</h2>
          <p className="section-subtitle">
            Traditional monitors ping from a single server. PulseGrid uses a consistent hash ring
            of distributed worker nodes backed by Redis consensus.
          </p>
        </div>

        <div className="arch-diagram-grid">
          <div className="arch-card">
            <div className="arch-step-badge">Step 1</div>
            <h3>Consistent Hash Ring</h3>
            <p>
              Your monitors are partitioned evenly across a ring of worker nodes. If a worker node
              restarts, adjacent nodes seamlessly take over without missing a single ping.
            </p>
          </div>

          <div className="arch-card">
            <div className="arch-step-badge">Step 2</div>
            <h3>3-Strike Consensus</h3>
            <p>
              No more 3:00 AM alerts for a 50ms transient network packet drop. A site is only declared
              DOWN if confirmed across 3 consecutive checks and verified by consensus.
            </p>
          </div>

          <div className="arch-card">
            <div className="arch-step-badge">Step 3</div>
            <h3>Asynchronous RabbitMQ Alerts</h3>
            <p>
              Alert events are decoupled through a message queue. Notification workers instantly
              fan out alerts to Telegram, Discord, and Email without slowing down active check loops.
            </p>
          </div>
        </div>
      </section>

      {/* 4. MULTI-PROTOCOL INTERACTIVE TABS */}
      <section className="interactive-tabs-section">
        <div className="text-center mb-6">
          <h2 className="section-title">One Tool For All Your Infrastructure</h2>
          <p className="section-subtitle">Switch between protocols with tailored diagnostic checks.</p>
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
            <span>Redis Caches</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'cron' ? 'active' : ''}`}
            onClick={() => setActiveTab('cron')}
          >
            <Clock size={16} />
            <span>Cron Heartbeats</span>
          </button>
        </div>

        <div className="tab-showcase-box">
          {activeTab === 'http' && (
            <div className="tab-details">
              <h3>HTTP & API Synthetic Checks</h3>
              <p>
                Assert status codes (200, 201, 301), verify JSON response bodies, and catch silent
                Cloudflare or Railway error screens before users complain.
              </p>
              <ul className="tab-checklist">
                <li><Check size={16} className="text-green" /> SSL / TLS expiration alerts 14 days in advance</li>
                <li><Check size={16} className="text-green" /> Keyword matching to prevent false 200 OKs</li>
                <li><Check size={16} className="text-green" /> High-resolution DNS, TLS, and TTFB latency metrics</li>
              </ul>
            </div>
          )}

          {activeTab === 'db' && (
            <div className="tab-details">
              <h3>Direct Database Wire Queries</h3>
              <p>
                Test real database responsiveness by opening transient TCP connections and running zero-cost <code>SELECT 1;</code> probes.
              </p>
              <ul className="tab-checklist">
                <li><Check size={16} className="text-green" /> Encrypted at rest using AES-256</li>
                <li><Check size={16} className="text-green" /> Detects connection pool starvation before your app locks up</li>
                <li><Check size={16} className="text-green" /> Works with Railway, Neon, Supabase, and AWS RDS</li>
              </ul>
            </div>
          )}

          {activeTab === 'redis' && (
            <div className="tab-details">
              <h3>In-Memory Redis Cache Monitoring</h3>
              <p>
                Direct RESP protocol validation. Ping your cache cluster and monitor memory consumption to prevent unexpected Out-Of-Memory (OOM) evictions.
              </p>
              <ul className="tab-checklist">
                <li><Check size={16} className="text-green" /> <code>PING</code> $\rightarrow$ <code>+PONG</code> verification in sub-5ms</li>
                <li><Check size={16} className="text-green" /> Warns when memory usage crosses 90% threshold</li>
                <li><Check size={16} className="text-green" /> Zero impact on production cache throughput</li>
              </ul>
            </div>
          )}

          {activeTab === 'cron' && (
            <div className="tab-details">
              <h3>Dead Man's Switch for Scheduled Jobs</h3>
              <p>
                Inverted monitoring. Add one simple <code>curl</code> line to your backup script, billing cron, or worker. If it doesn't ping on schedule, we alarm.
              </p>
              <ul className="tab-checklist">
                <li><Check size={16} className="text-green" /> Zero agent installation required</li>
                <li><Check size={16} className="text-green" /> Customizable grace period (e.g. 15 minutes)</li>
                <li><Check size={16} className="text-green" /> Instant alerts if backup scripts die halfway through</li>
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* 5. PRICING SECTION (SAAS TRANSPARENCY) */}
      <section className="pricing-section">
        <div className="text-center mb-6">
          <span className="arch-pill">Community First</span>
          <h2 className="section-title">Transparent Open-Source & SaaS Plans</h2>
          <p className="section-subtitle">
            Host it yourself for free on your own servers, or use our managed developer cloud.
          </p>
        </div>

        <div className="pricing-grid">
          {/* Plan 1 */}
          <div className="pricing-card">
            <span className="pricing-tier-label">Self-Hosted Community</span>
            <div className="price-tag">
              <span className="price-number">$0</span>
              <span className="price-term">/ forever</span>
            </div>
            <p className="pricing-desc">
              100% open source. Clone the repo and run on your own Docker or Kubernetes cluster.
            </p>
            <ul className="pricing-features">
              <li><Check size={16} className="text-green" /> Unlimited monitors</li>
              <li><Check size={16} className="text-green" /> Full source code access</li>
              <li><Check size={16} className="text-green" /> Community Discord support</li>
              <li><Check size={16} className="text-green" /> SQLite / PostgreSQL backend</li>
            </ul>
            <a href="https://github.com" className="btn-secondary w-full text-center">
              View on GitHub
            </a>
          </div>

          {/* Plan 2: Featured */}
          <div className="pricing-card featured">
            <div className="popular-badge">Most Popular for Devs</div>
            <span className="pricing-tier-label">Developer Cloud</span>
            <div className="price-tag">
              <span className="price-number">$0</span>
              <span className="price-term">/ month free</span>
            </div>
            <p className="pricing-desc">
              Zero setup required. Hosted on our distributed multi-region worker cluster.
            </p>
            <ul className="pricing-features">
              <li><Check size={16} className="text-green" /> Up to 50 active monitors</li>
              <li><Check size={16} className="text-green" /> 30-second check intervals</li>
              <li><Check size={16} className="text-green" /> Free Telegram & Discord alerts</li>
              <li><Check size={16} className="text-green" /> Public Status Page included</li>
            </ul>
            <Link to="/dashboard" className="btn-primary w-full text-center">
              Get Started Free
            </Link>
          </div>

          {/* Plan 3 */}
          <div className="pricing-card">
            <span className="pricing-tier-label">Team & Startup</span>
            <div className="price-tag">
              <span className="price-number">$29</span>
              <span className="price-term">/ month</span>
            </div>
            <p className="pricing-desc">
              For scaling startups requiring custom status domains, SMS alerts, and team RBAC.
            </p>
            <ul className="pricing-features">
              <li><Check size={16} className="text-green" /> Unlimited monitors & team members</li>
              <li><Check size={16} className="text-green" /> 10-second high-precision checks</li>
              <li><Check size={16} className="text-green" /> Custom domain (status.yourcompany.com)</li>
              <li><Check size={16} className="text-green" /> WhatsApp & SMS alert gateways</li>
            </ul>
            <button className="btn-secondary w-full" onClick={onOpenAddModal}>
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* 6. CALL TO ACTION BANNER */}
      <section className="cta-banner">
        <h2>Start Monitoring Your Infrastructure in 30 Seconds</h2>
        <p>No credit card required. Works with any public or private endpoint.</p>
        <div className="cta-banner-buttons">
          <Link to="/dashboard" className="btn-primary-large">
            Open Live Dashboard
          </Link>
          <button className="btn-secondary-large" onClick={onOpenAddModal}>
            + Add New Monitor
          </button>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="footer-container">
        <div className="footer-left">
          <div className="brand-logo">
            <Activity size={18} className="text-green" />
            <span className="brand-name">
              Pulse<span className="brand-accent">Grid</span>
            </span>
          </div>
          <p className="footer-copy">
            Built by Emmanuel & the open source developer community. Designed for resilience.
          </p>
        </div>
        <div className="footer-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/status">Public Status</Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
};
