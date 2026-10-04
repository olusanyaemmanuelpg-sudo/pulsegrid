import React, { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Activity, Plus, Sun, Moon, Bell, Shield } from './Icons';
import { useMonitors } from '../context/MonitorContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({ onOpenAddModal, onOpenAlertsModal }) => {
  const location = useLocation();
  const { metrics } = useMonitors();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isOperational = metrics.down === 0;
  const isAuthPage = location.pathname === '/login';

  return (
    <nav className="nav-container">
      <div className="nav-inner">
        {/* Brand */}
        <div className="brand-group">
          <Link to="/" className="brand-logo">
            <div className="logo-icon-wrap">
              <Activity size={20} className="logo-icon" />
            </div>
            <span className="brand-name">
              Pulse<span className="brand-accent">Grid</span>
            </span>
          </Link>
          {location.pathname === '/dashboard' && (
            <span className="brand-badge">Console</span>
          )}
          {location.pathname === '/admin' && (
            <span
              className="brand-badge"
              style={{
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#a78bfa',
                borderColor: 'rgba(139, 92, 246, 0.35)',
              }}
            >
              Admin
            </span>
          )}
        </div>

        {/* Center Links */}
        {!isAuthPage && (
          <div className="nav-links">
            {location.pathname === '/dashboard' || location.pathname === '/admin' ? (
              <>
                <Link
                  to="/dashboard"
                  className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
                >
                  Monitors
                </Link>
                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Shield size={14} />
                    <span>Admin</span>
                  </Link>
                )}
                <Link
                  to="/status"
                  className="nav-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Public Status ↗
                </Link>
              </>
            ) : location.pathname === '/status' ? (
              <>
                <Link to="/" className="nav-link">
                  Overview
                </Link>
                <Link to="/status" className={`nav-link active`}>
                  System Status
                </Link>
                {user && (
                  <Link to="/dashboard" className="nav-link">
                    Console
                  </Link>
                )}
              </>
            ) : (
              <>
                <a href="#features" className="nav-link">
                  Features
                </a>
                <a href="#architecture" className="nav-link">
                  How it Works
                </a>
                <Link
                  to="/status"
                  className={`nav-link ${location.pathname === '/status' ? 'active' : ''}`}
                >
                  Live Status
                </Link>
              </>
            )}
          </div>
        )}

        {/* Right Actions */}
        <div className="nav-actions">
          {/* Status pill */}
          {!isAuthPage && location.pathname !== '/' && (
            <div className={`status-pill ${isOperational ? 'up' : 'down'}`}>
              <span className="pulse-dot"></span>
              <span>
                {isOperational
                  ? 'All systems operational'
                  : `${metrics.down} service issue`}
              </span>
            </div>
          )}

          {/* Theme Switcher Toggle */}
          <button
            className="btn-icon theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {isAuthPage ? (
            <Link to="/" className="btn-secondary">
              Back to home
            </Link>
          ) : user ? (
            <>
              {location.pathname === '/dashboard' ? (
                <>
                  <button
                    className="btn-secondary"
                    onClick={onOpenAlertsModal}
                    title="Configure Multi-Channel Alert Broker"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Bell size={16} />
                    <span>Alerts</span>
                  </button>
                  <button className="btn-primary" onClick={onOpenAddModal}>
                    <Plus size={16} />
                    <span>Add monitor</span>
                  </button>
                </>
              ) : (
                <Link to="/dashboard" className="btn-primary">
                  <span>Dashboard →</span>
                </Link>
              )}
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
                    {user.role === 'admin' && (
                      <Link
                        to="/admin"
                        className="dropdown-item"
                        style={{ color: '#a78bfa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Shield size={14} />
                        <span>Admin Operations</span>
                      </Link>
                    )}
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenAlertsModal?.();
                      }}
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Alert Destinations
                    </button>
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
            </>
          ) : (
            <>
              <Link to="/login" className="btn-secondary nav-signin">
                Sign in
              </Link>
              <Link to="/login?mode=signup" className="btn-primary nav-signup">
                <span>Create account</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
