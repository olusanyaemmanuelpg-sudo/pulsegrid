import React from 'react';
import { Link, useLocation } from 'react-router';
import { Activity, Plus, Shield } from './Icons';
import { useMonitors } from '../context/MonitorContext';

export const Navbar = ({ onOpenAddModal }) => {
  const location = useLocation();
  const { metrics } = useMonitors();

  const isOperational = metrics.down === 0;

  return (
    <nav className="nav-container">
      <div className="nav-inner">
        {/* Brand */}
        <Link to="/" className="brand-logo">
          <div className="logo-icon-wrap">
            <Activity size={20} className="logo-icon" />
          </div>
          <span className="brand-name">
            Pulse<span className="brand-accent">Grid</span>
          </span>
          <span className="brand-badge">Distributed</span>
        </Link>

        {/* Center Links */}
        <div className="nav-links">
          <Link
            to="/"
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Overview
          </Link>
          <Link
            to="/dashboard"
            className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
          >
            Dashboard
          </Link>
          <Link
            to="/status"
            className={`nav-link ${location.pathname === '/status' ? 'active' : ''}`}
          >
            Status Page
          </Link>
        </div>

        {/* Right Actions */}
        <div className="nav-actions">
          {/* System status pill */}
          <div className={`status-pill ${isOperational ? 'up' : 'down'}`}>
            <span className="pulse-dot"></span>
            <span>{isOperational ? 'All Systems 100%' : `${metrics.down} Outage Detected`}</span>
          </div>

          <button className="btn-primary" onClick={onOpenAddModal}>
            <Plus size={16} />
            <span>Add Monitor</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
