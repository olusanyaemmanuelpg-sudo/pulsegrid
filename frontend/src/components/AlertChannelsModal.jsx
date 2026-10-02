import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Bell,
  Send,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Mail,
  Server,
  Globe,
  Plus,
} from './Icons';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

export const AlertChannelsModal = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // New channel form state
  const [type, setType] = useState('discord');
  const [name, setName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [chatId, setChatId] = useState('');
  const [email, setEmail] = useState('');
  const [secretHeader, setSecretHeader] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      fetchChannels();
    }
  }, [isOpen, token]);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setChannels(data.channels || []);
      }
    } catch (err) {
      console.error('Failed to load alert channels:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestChannel = async (channelId) => {
    setTestingId(channelId);
    setTestResult(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/alerts/channels/${channelId}/test`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (res.ok) {
        setTestResult({
          id: channelId,
          success: true,
          message: data.message || 'Test alert delivered!',
        });
      } else {
        setTestResult({
          id: channelId,
          success: false,
          message: data.message || 'Delivery failed.',
        });
      }
    } catch (err) {
      setTestResult({
        id: channelId,
        success: false,
        message: err.message || 'Network error.',
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleEnable = async (channel) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/alerts/channels/${channel.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_enabled: !channel.is_enabled }),
        },
      );
      if (res.ok) {
        setChannels((prev) =>
          prev.map((c) =>
            c.id === channel.id ? { ...c, is_enabled: !c.is_enabled } : c,
          ),
        );
      }
    } catch (err) {
      console.error('Toggle failed:', err.message);
    }
  };

  const handleDeleteChannel = async (channelId) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/alerts/channels/${channelId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        setChannels((prev) => prev.filter((c) => c.id !== channelId));
      }
    } catch (err) {
      console.error('Delete failed:', err.message);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter a channel name.');
      return;
    }

    setSaving(true);
    setFormError('');

    const config = {};
    if (type === 'discord' || type === 'webhook') {
      config.webhook_url = webhookUrl.trim();
      if (secretHeader.trim()) config.secret_header = secretHeader.trim();
    } else if (type === 'telegram') {
      config.chat_id = chatId.trim();
    } else if (type === 'email') {
      config.email = email.trim();
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          name: name.trim(),
          config,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create channel.');
      }

      setChannels((prev) => [data.channel, ...prev]);
      setShowAddForm(false);
      setName('');
      setWebhookUrl('');
      setChatId('');
      setEmail('');
      setSecretHeader('');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const getChannelIcon = (chType) => {
    switch (chType) {
      case 'discord':
        return <Server size={18} className="text-blue" />;
      case 'telegram':
        return <Send size={18} className="text-purple" />;
      case 'webhook':
        return <Globe size={18} className="text-yellow" />;
      case 'email':
        return <Mail size={18} className="text-green" />;
      default:
        return <Bell size={18} />;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '640px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Bell size={20} className="text-blue" />
            <div>
              <h2 className="modal-title">Multi-Channel Alert Broker</h2>
              <p className="modal-subtitle">
                Asynchronous fan-out incident & recovery notifications via
                message queue
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Header Action */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Active Channels: <strong>{channels.length}</strong>
            </span>
            <button
              className="btn-secondary"
              onClick={() => {
                setShowAddForm(!showAddForm);
                setFormError('');
              }}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            >
              <Plus size={14} />
              <span>{showAddForm ? 'Cancel' : 'Add Channel'}</span>
            </button>
          </div>

          {/* Add Channel Form */}
          {showAddForm && (
            <form
              onSubmit={handleCreateChannel}
              className="add-channel-card"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>
                New Alert Destination
              </h3>

              {formError && (
                <div
                  className="card-outage-alert"
                  style={{ marginBottom: '1rem', padding: '0.6rem' }}
                >
                  <AlertTriangle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Channel Type Selector */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Channel Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {[
                    { id: 'discord', label: 'Discord' },
                    { id: 'telegram', label: 'Telegram' },
                    { id: 'webhook', label: 'Webhook' },
                    { id: 'email', label: 'Email' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`type-pill ${type === t.id ? 'active' : ''}`}
                      onClick={() => setType(t.id)}
                      style={{
                        padding: '0.5rem',
                        fontSize: '0.75rem',
                        textAlign: 'center',
                        borderRadius: '6px',
                        border: type === t.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        background: type === t.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        color: type === t.id ? 'var(--primary)' : 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Channel Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. SRE Production Alerts"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {/* Type-Specific Inputs */}
              {(type === 'discord' || type === 'webhook') && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">
                    {type === 'discord' ? 'Discord Webhook URL' : 'Webhook Endpoint URL'}
                  </label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder={
                      type === 'discord'
                        ? 'https://discord.com/api/webhooks/...'
                        : 'https://pagerduty.com/webhook or https://api.mycorp.com/alerts'
                    }
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    required
                  />
                </div>
              )}

              {type === 'webhook' && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">HMAC / Auth Signature Token (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="X-PulseGrid-Signature token"
                    value={secretHeader}
                    onChange={(e) => setSecretHeader(e.target.value)}
                  />
                </div>
              )}

              {type === 'telegram' && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Telegram Chat ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. -100123456789 or @channelname"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    required
                  />
                </div>
              )}

              {type === 'email' && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Recipient Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="ops@pulsegrid.dev"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Registering...' : 'Save Channel'}
                </button>
              </div>
            </form>
          )}

          {/* Test Status Feedback Banner */}
          {testResult && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                marginBottom: '1rem',
                background: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: testResult.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                color: testResult.success ? 'var(--status-up)' : 'var(--status-down)',
                fontSize: '0.875rem',
              }}
            >
              {testResult.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Channels List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Loading alert channels...
            </div>
          ) : channels.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1.5rem',
                border: '1px dashed var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-muted)',
              }}
            >
              <Bell size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                No Alert Channels Configured
              </p>
              <p style={{ fontSize: '0.8rem' }}>
                Add Discord webhooks, Slack, or Telegram to receive real-time incident notifications.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {channels.map((ch) => {
                const cfg = typeof ch.config === 'string' ? JSON.parse(ch.config) : ch.config || {};
                const isTesting = testingId === ch.id;

                return (
                  <div
                    key={ch.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.85rem 1rem',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      opacity: ch.is_enabled ? 1 : 0.6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {getChannelIcon(ch.type)}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.9rem' }}>{ch.name}</strong>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              textTransform: 'uppercase',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {ch.type}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            margin: '0.15rem 0 0',
                            maxWidth: '300px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cfg.webhook_url || cfg.email || `Chat: ${cfg.chat_id || 'System Bot'}`}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Active toggle */}
                      <button
                        className="btn-icon"
                        title={ch.is_enabled ? 'Disable Channel' : 'Enable Channel'}
                        onClick={() => handleToggleEnable(ch)}
                        style={{
                          color: ch.is_enabled ? 'var(--status-up)' : 'var(--text-muted)',
                        }}
                      >
                        <CheckCircle size={16} />
                      </button>

                      {/* Test Alert Button */}
                      <button
                        className={`btn-icon ${isTesting ? 'spinning' : ''}`}
                        title="Send Test Notification"
                        onClick={() => handleTestChannel(ch.id)}
                        disabled={isTesting}
                      >
                        <Send size={15} />
                      </button>

                      {/* Delete */}
                      <button
                        className="btn-icon danger"
                        title="Delete Channel"
                        onClick={() => handleDeleteChannel(ch.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
