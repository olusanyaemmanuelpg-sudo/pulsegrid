import React, { useState } from 'react';
import { Link } from 'react-router';
import { useMonitors } from '../context/MonitorContext';
import { useAuth } from '../context/AuthContext';
import { MonitorCard } from '../components/MonitorCard';
import {
  Activity,
  Globe,
  Database,
  Server,
  Clock,
  Plus,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Bell,
  Megaphone,
} from '../components/Icons';

export const DashboardPage = ({ onOpenAddModal, onOpenAlertsModal }) => {
  const { monitors, metrics, testMonitor, systemStatus } = useMonitors();
  const { user } = useAuth();
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const filteredMonitors = monitors.filter((m) => {
    const matchesType =
      filterType === 'all' ||
      (filterType === 'http' && m.type === 'http') ||
      (filterType === 'db' && (m.type === 'postgres' || m.type === 'mysql')) ||
      (filterType === 'redis' && m.type === 'redis') ||
      (filterType === 'cron' && m.type === 'cron');

    const matchesQuery =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.target.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesQuery;
  });

  const handleExportCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        'ID,Name,Type,Target,Status,Latency_ms,Uptime_90d\n' +
        monitors
          .map(
            (m) =>
              `${m.id},"${m.name}",${m.type},"${m.target}",${m.status},${m.latency},${m.uptime90d}%`
          )
          .join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `pulsegrid-telemetry-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExporting(false);
    }, 500);
  };

  const [testingAll, setTestingAll] = useState(false);

  const handleTestAll = async () => {
    if (testingAll || monitors.length === 0) return;
    setTestingAll(true);
    try {
      await Promise.allSettled(monitors.map((m) => testMonitor(m.id)));
    } finally {
      setTestingAll(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Dashboard Top Header */}
      <div className="dashboard-header-row">
        <div>
          <div className="project-breadcrumb">
            <span className="project-tag">Project</span>
            <span className="project-name">
              {user ? `${user.name}'s Cluster` : 'Production Workload (Primary)'}
            </span>
            <span className="cluster-region">Region: eu-west-1 • 3 Nodes</span>
          </div>
          <h1 className="dashboard-title">Infrastructure Overview</h1>
        </div>

        <div className="dashboard-header-actions">
          <button
            className="btn-secondary"
            onClick={onOpenAlertsModal}
            title="Configure Asynchronous Multi-Channel Alert Broker"
          >
            <Bell size={15} />
            <span>Alert Channels</span>
          </button>
          <button
            className={`btn-secondary ${testingAll ? 'spinning' : ''}`}
            onClick={handleTestAll}
            disabled={testingAll}
            title="Ping all monitors"
          >
            <RefreshCw size={15} />
            <span>{testingAll ? 'Testing Probes...' : 'Test All Probes'}</span>
          </button>
          <button
            className="btn-secondary"
            onClick={handleExportCSV}
            disabled={isExporting}
            title="Download Telemetry CSV"
          >
            <Download size={15} />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
          <button className="btn-primary" onClick={onOpenAddModal}>
            <Plus size={16} />
            <span>New Monitor</span>
          </button>
        </div>
      </div>

      {/* Platform Announcement Banner (if active) */}
      {systemStatus?.announcement?.active && (
        <div
          className={`platform-announcement-banner level-${systemStatus.announcement.level || 'info'}`}
          style={{
            marginBottom: '1.5rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            background:
              systemStatus.announcement.level === 'critical'
                ? 'rgba(239, 68, 68, 0.12)'
                : systemStatus.announcement.level === 'warning'
                ? 'rgba(245, 158, 11, 0.12)'
                : systemStatus.announcement.level === 'maintenance'
                ? 'rgba(139, 92, 246, 0.12)'
                : 'rgba(59, 130, 246, 0.12)',
            border:
              systemStatus.announcement.level === 'critical'
                ? '1px solid rgba(239, 68, 68, 0.3)'
                : systemStatus.announcement.level === 'warning'
                ? '1px solid rgba(245, 158, 11, 0.3)'
                : systemStatus.announcement.level === 'maintenance'
                ? '1px solid rgba(139, 92, 246, 0.3)'
                : '1px solid rgba(59, 130, 246, 0.3)',
            color:
              systemStatus.announcement.level === 'critical'
                ? '#ef4444'
                : systemStatus.announcement.level === 'warning'
                ? '#f59e0b'
                : systemStatus.announcement.level === 'maintenance'
                ? '#a78bfa'
                : '#60a5fa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            <Megaphone size={18} />
            <span style={{ fontSize: '0.875rem' }}>
              <strong>{systemStatus.announcement.title}:</strong> {systemStatus.announcement.message}
            </span>
          </div>
          <Link
            to="/status"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              textDecoration: 'underline',
              color: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            Status Page ↗
          </Link>
        </div>
      )}

      {/* Top Banner / Metrics Overview */}
      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Probes</span>
            <Activity size={18} className="metric-icon" />
          </div>
          <div className="metric-number-row">
            <span className="metric-big-number">{metrics.total}</span>
            <span className="metric-subtext">
              <span className="text-green font-bold">{metrics.up} Operational</span> •{' '}
              <span className={metrics.down > 0 ? 'text-red font-bold' : 'text-muted'}>
                {metrics.down} Down
              </span>
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">System Uptime</span>
            <CheckCircle size={18} className="metric-icon text-green" />
          </div>
          <div className="metric-number-row">
            <span className="metric-big-number text-green">{metrics.uptime}%</span>
            <span className="metric-subtext font-mono text-green">Target: 99.9% SLA</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Outages</span>
            <AlertTriangle
              size={18}
              className={metrics.down > 0 ? 'metric-icon text-red' : 'metric-icon text-muted'}
            />
          </div>
          <div className="metric-number-row">
            <span className={`metric-big-number ${metrics.down > 0 ? 'text-red' : 'text-green'}`}>
              {metrics.down}
            </span>
            <span className="metric-subtext">
              {metrics.down === 0 ? 'Zero service interruption' : 'Degraded services'}
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Cluster Latency</span>
            <Clock size={18} className="metric-icon" />
          </div>
          <div className="metric-number-row">
            <span className="metric-big-number">{metrics.avgLatency} ms</span>
            <span className="metric-subtext">Consensus roundtrip</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="controls-bar">
        <div className="filter-chips">
          <button
            className={`filter-chip ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All Monitors ({monitors.length})
          </button>
          <button
            className={`filter-chip ${filterType === 'http' ? 'active' : ''}`}
            onClick={() => setFilterType('http')}
          >
            <Globe size={14} />
            <span>Web & APIs</span>
          </button>
          <button
            className={`filter-chip ${filterType === 'db' ? 'active' : ''}`}
            onClick={() => setFilterType('db')}
          >
            <Database size={14} />
            <span>Databases</span>
          </button>
          <button
            className={`filter-chip ${filterType === 'redis' ? 'active' : ''}`}
            onClick={() => setFilterType('redis')}
          >
            <Server size={14} />
            <span>Redis</span>
          </button>
          <button
            className={`filter-chip ${filterType === 'cron' ? 'active' : ''}`}
            onClick={() => setFilterType('cron')}
          >
            <Clock size={14} />
            <span>Crons</span>
          </button>
        </div>

        <div className="search-and-cta">
          <input
            type="text"
            className="search-input"
            placeholder="Search probes by name or target..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Monitor Cards List */}
      <div className="monitors-list">
        {filteredMonitors.length > 0 ? (
          filteredMonitors.map((mon) => <MonitorCard key={mon.id} monitor={mon} />)
        ) : (
          <div className="empty-state">
            <Activity size={40} className="empty-icon" />
            <h3>No monitors match your filter</h3>
            <p>Try searching for a different keyword or create a new infrastructure check.</p>
            <button className="btn-primary mt-4" onClick={onOpenAddModal}>
              <Plus size={16} />
              <span>Create Monitor</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
