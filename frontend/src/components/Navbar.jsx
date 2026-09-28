import React, { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Activity, Plus, Sun, Moon, Github, User, Bell } from './Icons';
import { useMonitors } from '../context/MonitorContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({ onOpenAddModal, onOpenAuthModal }) => {
  const location = useLocation();
  const { metrics } = useMonitors();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

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
          <span className="brand-badge">SaaS</span>
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
          {/* Status pill */}
          <div className={`status-pill ${isOperational ? 'up' : 'down'}`}>
            <span className="pulse-dot"></span>
            <span>{isOperational ? 'All Systems 100%' : `${metrics.down} Outage`}</span>
          </div>

          {/* Theme Switcher Toggle */}
          <button
            className="btn-icon theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* GitHub Star Pill */}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-github-pill"
            title="Star PulseGrid on GitHub"
          >
            <Github size={15} />
            <span className="star-count">★ 1.4k</span>
          </a>

          {/* Add Monitor CTA */}
          <button className="btn-primary" onClick={onOpenAddModal}>
            <Plus size={16} />
            <span>Add Monitor</span>
          </button>

          {/* User Auth or Profile */}
          {user ? (
            <div className="user-profile-wrap">
              <button
                className="user-profile-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="user-avatar-circle">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="user-name-text">{user.name}</span>
              </button>

              {showUserMenu && (
                <div className="user-dropdown-menu">
                  <div className="dropdown-user-info">
                    <strong>{user.name}</strong>
                    <span className="dropdown-role">{user.role}</span>
                  </div>
                  <div className="dropdown-divider"></div>
                  <Link
                    to="/dashboard"
                    className="dropdown-item"
                    onClick={() => setShowUserMenu(false)}
                  >
                    Console Overview
                  </Link>
                  <Link
                    to="/status"
                    className="dropdown-item"
                    onClick={() => setShowUserMenu(false)}
                  >
                    Public Status Page
                  </Link>
                  <div className="dropdown-divider"></div>
                  <button
                    className="dropdown-item text-red"
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="btn-secondary" onClick={onOpenAuthModal}>
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
