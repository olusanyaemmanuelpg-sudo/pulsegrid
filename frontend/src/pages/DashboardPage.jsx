import React, { useState } from 'react';
import { useMonitors } from '../context/MonitorContext';
import { MonitorCard } from '../components/MonitorCard';
import { Activity, Globe, Database, Server, Clock, Plus, AlertTriangle, CheckCircle } from '../components/Icons';

export const DashboardPage = ({ onOpenAddModal }) => {
  const { monitors, metrics } = useMonitors();
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className="dashboard-container">
      {/* Top Banner / Metrics Overview */}
      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Monitors</span>
            <Activity size={18} className="metric-icon" />
          </div>
          <div className="metric-number-row">
            <span className="metric-big-number">{metrics.total}</span>
            <span className="metric-subtext">
              <span className="text-green font-bold">{metrics.up} Up</span> •{' '}
              <span className={metrics.down > 0 ? 'text-red font-bold' : 'text-muted'}>
                {metrics.down} Down
              </span>
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">90-Day Uptime</span>
            <CheckCircle size={18} className="metric-icon text-green" />
          </div>
          <div className="metric-number-row">
            <span className="metric-big-number text-green">{metrics.uptime}%</span>
            <span className="metric-subtext">Consensus verified</span>
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
              {metrics.down === 0 ? 'No incidents active' : 'Attention required'}
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Avg Latency</span>
            <Clock size={18} className="metric-icon" />
          </div>
          <div className="metric-number-row">
            <span className="metric-big-number">{metrics.avgLatency} ms</span>
            <span className="metric-subtext">Across active worker nodes</span>
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
            All ({monitors.length})
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
            <span>Cron Heartbeats</span>
          </button>
        </div>

        <div className="search-and-cta">
          <input
            type="text"
            className="search-input"
            placeholder="Filter by name or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="btn-primary" onClick={onOpenAddModal}>
            <Plus size={16} />
            <span>New Monitor</span>
          </button>
        </div>
      </div>

      {/* Monitor Cards List */}
      <div className="monitors-list">
        {filteredMonitors.length > 0 ? (
          filteredMonitors.map((mon) => <MonitorCard key={mon.id} monitor={mon} />)
        ) : (
          <div className="empty-state">
            <Activity size={40} className="empty-icon" />
            <h3>No monitors found</h3>
            <p>Try adjusting your search filter or add a new infrastructure monitor.</p>
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
