import React, { useState } from 'react';
import { Globe, Database, Server, Clock, Shield, Check, Copy } from './Icons';
import { useMonitors } from '../context/MonitorContext';
import { useAuth } from '../context/AuthContext';

export const AddMonitorModal = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { addMonitor } = useMonitors();
  const [monitorType, setMonitorType] = useState('http');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [interval, setInterval] = useState(30);
  const [keyword, setKeyword] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState(false);

  const generatedCronUrl = `https://pulsegrid.dev/ping/${name ? name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'my-cron'}`;

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setFormError('');

    let finalTarget = target;
    if (monitorType === 'cron') {
      finalTarget = generatedCronUrl;
    }

    try {
      await addMonitor({
        name: name.trim(),
        type: monitorType,
        target: finalTarget.trim(),
        interval: Number(interval),
        keyword: keyword.trim() || undefined,
        isPublic: user?.role === 'admin' ? isPublic : false,
      });

      // Reset form on success
      setName('');
      setTarget('');
      setKeyword('');
      setIsPublic(false);
      setFormError('');
      onClose();
    } catch (err) {
      setFormError(err.message || 'Failed to create monitor.');
    }
  };
  const handleCopyCron = () => {
    navigator.clipboard.writeText(
      'Create the monitor first, then copy the secure heartbeat command from the monitor card.',
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Add Infrastructure Monitor</h2>
            <p className="modal-subtitle">
              Distributed checking across worker ring with 3-strike
              verification.
            </p>
          </div>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Type Selector Tabs */}
        <div className="type-tabs">
          <button
            type="button"
            className={`type-tab ${monitorType === 'http' ? 'active' : ''}`}
            onClick={() => setMonitorType('http')}
          >
            <Globe size={18} />
            <span>HTTP / API</span>
          </button>

          <button
            type="button"
            className={`type-tab ${monitorType === 'postgres' ? 'active' : ''}`}
            onClick={() => setMonitorType('postgres')}
          >
            <Database size={18} />
            <span>PostgreSQL / MySQL</span>
          </button>

          <button
            type="button"
            className={`type-tab ${monitorType === 'redis' ? 'active' : ''}`}
            onClick={() => setMonitorType('redis')}
          >
            <Server size={18} />
            <span>Redis Cache</span>
          </button>

          <button
            type="button"
            className={`type-tab ${monitorType === 'cron' ? 'active' : ''}`}
            onClick={() => setMonitorType('cron')}
          >
            <Clock size={18} />
            <span>Cron Heartbeat</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="modal-form">
          {formError && (
            <p className="auth-error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-group">
            <label className="form-label">Monitor Friendly Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Production Railway API, Main DB, Daily Backup"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {monitorType === 'http' && (
            <>
              <div className="form-group">
                <label className="form-label">Endpoint URL to Monitor</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://api.myapp.com/health"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Keyword Assertion (Optional)
                  <span className="label-tip">
                    Verifies page contains text (prevents false 200s on error
                    pages)
                  </span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ok, healthy, Welcome"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
            </>
          )}

          {monitorType === 'postgres' && (
            <>
              <div className="form-group">
                <label className="form-label">Database Connection String</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="postgresql://user:password@db.railway.app:5432/main"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  required
                />
                <div className="security-note">
                  <Shield size={14} />
                  <span>
                    Encrypted at rest with AES-256. Tested via{' '}
                    <code>SELECT 1;</code> query.
                  </span>
                </div>
              </div>
            </>
          )}

          {monitorType === 'redis' && (
            <>
              <div className="form-group">
                <label className="form-label">
                  Redis Connection String or Host
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="redis://:password@redis.railway.app:6379"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  required
                />
                <div className="security-note">
                  <Shield size={14} />
                  <span>
                    Tested via RESP <code>PING</code> command. Verifies memory
                    usage.
                  </span>
                </div>
              </div>
            </>
          )}

          {monitorType === 'cron' && (
            <div className="cron-setup-box">
              <p className="cron-desc">
                Save the monitor to generate a secure heartbeat URL with a
                private token. Copy it from the dashboard card after creation.
              </p>
              <div className="code-snippet-box">
                <code>save monitor → copy tokenized heartbeat command</code>
                <button
                  type="button"
                  className="btn-copy"
                  onClick={handleCopyCron}
                  title="Copy setup note"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <span className="cron-footnote">
                If our engine doesn't receive a heartbeat within the chosen
                schedule + 10m grace period, we alert you!
              </span>
            </div>
          )}

          {/* Interval Setting */}
          <div className="form-group">
            <label className="form-label">Check Frequency / Schedule</label>
            <select
              className="form-select"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            >
              <option value={30}>Every 30 seconds (High Precision)</option>
              <option value={60}>Every 1 minute (Standard)</option>
              <option value={300}>Every 5 minutes</option>
              {monitorType === 'cron' && (
                <>
                  <option value={3600}>Hourly Cron (Every 1 hour)</option>
                  <option value={86400}>Daily Cron (Every 24 hours)</option>
                </>
              )}
            </select>
          </div>

          {/* Admin Showcase on Status Page option */}
          {user?.role === 'admin' && (
            <div
              className="form-group"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                marginTop: '0.5rem',
              }}
            >
              <input
                type="checkbox"
                id="isPublicMonitor"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label
                htmlFor="isPublicMonitor"
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  margin: 0,
                  userSelect: 'none',
                  color: isPublic ? '#10b981' : 'var(--text-secondary, #d4d4d8)',
                }}
              >
                🌐 Publish on Public Status Page (Showcase this service)
              </label>
            </div>
          )}

          {/* Footer Actions */}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Start Monitoring
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
