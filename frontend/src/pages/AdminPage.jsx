import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import {
  getAdminOverview,
  getAdminUsers,
  getAdminMonitors,
  updateUserRole,
  testMonitorAsAdmin,
  deleteMonitorAsAdmin,
} from '../api/adminApi';
import {
  Users,
  Activity,
  Globe,
  Database,
  Server,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Play,
  Cpu,
  Layers,
  ArrowRight,
  Filter,
} from '../components/Icons';

export const AdminPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'services' | 'cluster'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Overview Metrics
  const [overview, setOverview] = useState(null);

  // Users Tab State
  const [usersList, setUsersList] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [updatingRoleId, setUpdatingRoleId] = useState(null);

  // Services Tab State
  const [monitorsList, setMonitorsList] = useState([]);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [testingMonitorId, setTestingMonitorId] = useState(null);
  const [deletingMonitorId, setDeletingMonitorId] = useState(null);

  // Load Admin Data
  const loadAdminData = async (isManualRefresh = false) => {
    if (!token) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [overviewData, usersData, monitorsData] = await Promise.all([
        getAdminOverview(token),
        getAdminUsers(token),
        getAdminMonitors(token),
      ]);

      setOverview(overviewData);
      setUsersList(usersData.users || []);
      setMonitorsList(monitorsData.monitors || []);
    } catch (err) {
      console.error('Failed to load admin telemetry:', err);
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to retrieve administrative data.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (token && user?.role === 'admin') {
      loadAdminData();
    }
  }, [token, user]);

  // Handle Role Toggle
  const handleToggleRole = async (targetUser) => {
    if (!token) return;
    const newRole = targetUser.role === 'admin' ? 'developer' : 'admin';
    const confirmPrompt =
      newRole === 'admin'
        ? `Grant Administrator privileges to ${targetUser.name} (${targetUser.email})?`
        : `Demote ${targetUser.name} (${targetUser.email}) to standard Developer?`;

    if (!window.confirm(confirmPrompt)) return;

    setUpdatingRoleId(targetUser.id);
    try {
      const result = await updateUserRole(token, targetUser.id, newRole);
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === targetUser.id ? { ...u, role: result.user.role } : u
        )
      );
      setActionMessage({
        type: 'success',
        text: `Role for ${targetUser.name} updated to ${result.user.role.toUpperCase()}.`,
      });
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to update user role.',
      });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // Handle Admin Manual Probe Test
  const handleTestMonitor = async (monitorId) => {
    if (!token || testingMonitorId) return;
    setTestingMonitorId(monitorId);

    try {
      const result = await testMonitorAsAdmin(token, monitorId);
      setMonitorsList((prev) =>
        prev.map((m) =>
          m.id === monitorId
            ? {
                ...m,
                status: result.status,
                lastLatencyMs: result.latency,
                lastCheckedAt: new Date().toISOString(),
              }
            : m
        )
      );
      setActionMessage({
        type: 'success',
        text: `Probe test completed for service #${monitorId}: Status ${result.status.toUpperCase()} (${result.latency}ms).`,
      });
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Probe execution failed.',
      });
    } finally {
      setTestingMonitorId(null);
    }
  };

  // Handle Admin Service Deletion
  const handleDeleteMonitor = async (monitor) => {
    if (!token || deletingMonitorId) return;
    if (
      !window.confirm(
        `Are you sure you want to permanently remove "${monitor.name}" (${monitor.type}) owned by ${monitor.userEmail}?`
      )
    ) {
      return;
    }

    setDeletingMonitorId(monitor.id);
    try {
      await deleteMonitorAsAdmin(token, monitor.id);
      setMonitorsList((prev) => prev.filter((m) => m.id !== monitor.id));
      setActionMessage({
        type: 'success',
        text: `Service "${monitor.name}" removed from platform.`,
      });
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to remove service.',
      });
    } finally {
      setDeletingMonitorId(null);
    }
  };

  // Switch to services tab filtered by specific user
  const handleFilterByUser = (userId) => {
    setSelectedUserFilter(String(userId));
    setActiveTab('services');
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const q = userSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [usersList, userSearchQuery]);

  // Filtered Monitors
  const filteredMonitors = useMemo(() => {
    return monitorsList.filter((m) => {
      const matchesUser =
        selectedUserFilter === 'all' ||
        String(m.userId) === String(selectedUserFilter);

      const matchesType =
        selectedTypeFilter === 'all' || m.type === selectedTypeFilter;

      const matchesStatus =
        selectedStatusFilter === 'all' || m.status === selectedStatusFilter;

      const q = serviceSearchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.targetPreview && m.targetPreview.toLowerCase().includes(q)) ||
        m.userName.toLowerCase().includes(q) ||
        m.userEmail.toLowerCase().includes(q);

      return matchesUser && matchesType && matchesStatus && matchesQuery;
    });
  }, [
    monitorsList,
    selectedUserFilter,
    selectedTypeFilter,
    selectedStatusFilter,
    serviceSearchQuery,
  ]);

  if (user && user.role !== 'admin') {
    return null;
  }

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="dashboard-container admin-container">
      {/* Top Header */}
      <div className="dashboard-header-row">
        <div>
          <div className="project-breadcrumb">
            <span className="project-tag" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.3)' }}>
              Root Privileges
            </span>
            <span className="project-name">PulseGrid Platform Administration</span>
            <span className="cluster-region">Distributed Mesh Control Plane</span>
          </div>
          <h1 className="dashboard-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Shield size={28} style={{ color: '#8b5cf6' }} />
            <span>Admin Operations Console</span>
          </h1>
        </div>

        <div className="dashboard-header-actions">
          <button
            className="btn-secondary"
            onClick={() => loadAdminData(true)}
            disabled={refreshing}
            title="Refresh All Telemetry"
          >
            <RefreshCw size={15} className={refreshing ? 'spin-anim' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <Link to="/dashboard" className="btn-secondary">
            <span>Back to Console</span>
          </Link>
        </div>
      </div>

      {/* Global Action Banner */}
      {actionMessage && (
        <div
          className={`alert-banner ${actionMessage.type === 'error' ? 'alert-error' : 'alert-success'}`}
          style={{
            marginBottom: '1.5rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background:
              actionMessage.type === 'error'
                ? 'rgba(239, 68, 68, 0.12)'
                : 'rgba(16, 185, 129, 0.12)',
            border:
              actionMessage.type === 'error'
                ? '1px solid rgba(239, 68, 68, 0.3)'
                : '1px solid rgba(16, 185, 129, 0.3)',
            color: actionMessage.type === 'error' ? '#ef4444' : '#10b981',
          }}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        {/* Total Users */}
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
            <Users size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Platform Users</span>
            <div className="stat-value-group">
              <span className="stat-number">{overview?.users?.total ?? 0}</span>
              {overview?.users?.newThisWeek > 0 && (
                <span className="stat-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px' }}>
                  +{overview.users.newThisWeek} new this week
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Total Services */}
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <Activity size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Services Monitored</span>
            <div className="stat-value-group">
              <span className="stat-number">{overview?.monitors?.total ?? 0}</span>
              <div style={{ display: 'flex', gap: '0.35rem', marginLeft: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                  {overview?.monitors?.byStatus?.up ?? 0} Up
                </span>
                <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                  • {overview?.monitors?.byStatus?.down ?? 0} Down
                </span>
                {overview?.monitors?.byStatus?.pending > 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>
                    • {overview.monitors.byStatus.pending} Pending
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 24h Checks */}
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <CheckCircle size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">24h Probes Dispatched</span>
            <div className="stat-value-group">
              <span className="stat-number">
                {overview?.checks?.last24Hours?.toLocaleString() ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Cluster Workers & Pipeline Depth */}
        <div className="stat-card">
          <div className="stat-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <Cpu size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Consistent Hash Ring</span>
            <div className="stat-value-group">
              <span className="stat-number">
                {overview?.cluster?.workerCount ?? 0}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)' }}>
                Active Workers
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #888)', marginTop: '2px' }}>
              Buffer: {overview?.cluster?.telemetryBufferDepth ?? 0} • Queue: {overview?.cluster?.alertQueueDepth ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="admin-tabs" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color, #27272a)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            background: activeTab === 'users' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            color: activeTab === 'users' ? '#8b5cf6' : 'var(--text-muted, #a1a1aa)',
          }}
        >
          <Users size={16} />
          <span>User Directory</span>
          <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '10px' }}>
            {usersList.length}
          </span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            background: activeTab === 'services' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            color: activeTab === 'services' ? '#8b5cf6' : 'var(--text-muted, #a1a1aa)',
          }}
        >
          <Activity size={16} />
          <span>Platform Services (View as User)</span>
          <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '10px' }}>
            {monitorsList.length}
          </span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'cluster' ? 'active' : ''}`}
          onClick={() => setActiveTab('cluster')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            background: activeTab === 'cluster' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            color: activeTab === 'cluster' ? '#8b5cf6' : 'var(--text-muted, #a1a1aa)',
          }}
        >
          <Layers size={16} />
          <span>Cluster & Telemetry</span>
        </button>
      </div>

      {/* TAB 1: USERS DIRECTORY */}
      {activeTab === 'users' && (
        <div className="admin-tab-content">
          <div className="filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div className="search-input-wrap" style={{ position: 'relative', width: '320px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #71717a)' }} />
              <input
                type="text"
                placeholder="Search user name or email..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #27272a)',
                  background: 'var(--bg-card, #18181b)',
                  color: 'inherit',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #a1a1aa)' }}>
              Showing {filteredUsers.length} of {usersList.length} users
            </span>
          </div>

          <div className="admin-table-wrap" style={{ overflowX: 'auto', background: 'var(--bg-card, #18181b)', borderRadius: '12px', border: '1px solid var(--border-color, #27272a)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color, #27272a)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)' }}>User</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)' }}>Role</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)' }}>Onboarded</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)' }}>Services Breakdown</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)' }}>Last Activity</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted, #71717a)' }}>
                      No registered users found matching "{userSearchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = u.id === user.id;
                    const isUpdating = updatingRoleId === u.id;

                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color, #27272a)' }}>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: u.role === 'admin' ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'rgba(255,255,255,0.1)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: '0.8rem',
                              }}
                            >
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {u.name} {isSelf && <span style={{ fontSize: '0.7rem', color: '#8b5cf6', marginLeft: '4px' }}>(You)</span>}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #a1a1aa)' }}>{u.email}</div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <span
                            style={{
                              padding: '3px 10px',
                              borderRadius: '20px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              background:
                                u.role === 'admin'
                                  ? 'rgba(139, 92, 246, 0.15)'
                                  : 'rgba(59, 130, 246, 0.15)',
                              color: u.role === 'admin' ? '#a78bfa' : '#60a5fa',
                              border: `1px solid ${
                                u.role === 'admin'
                                  ? 'rgba(139, 92, 246, 0.3)'
                                  : 'rgba(59, 130, 246, 0.3)'
                              }`,
                            }}
                          >
                            {u.role}
                          </span>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: '0.85rem' }}>{formatTimestamp(u.created_at)}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #71717a)' }}>
                            {timeAgo(u.created_at)}
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                              {u.total_monitors} {u.total_monitors === 1 ? 'service' : 'services'}
                            </span>
                            {u.total_monitors > 0 && (
                              <div style={{ display: 'flex', gap: '4px', fontSize: '0.75rem' }}>
                                <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                                  {u.up_monitors} up
                                </span>
                                {u.down_monitors > 0 && (
                                  <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                                    {u.down_monitors} down
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.8rem', color: u.last_activity_at ? 'inherit' : 'var(--text-muted, #71717a)' }}>
                            {u.last_activity_at ? timeAgo(u.last_activity_at) : 'No probes yet'}
                          </span>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                              className="btn-secondary"
                              onClick={() => handleFilterByUser(u.id)}
                              title="Inspect this user's services"
                              style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <span>Inspect Services</span>
                              <ArrowRight size={12} />
                            </button>

                            <button
                              className="btn-secondary"
                              onClick={() => handleToggleRole(u)}
                              disabled={isSelf || isUpdating}
                              title={
                                isSelf
                                  ? 'You cannot change your own role.'
                                  : u.role === 'admin'
                                  ? 'Demote to Developer'
                                  : 'Promote to Admin'
                              }
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.75rem',
                                color: u.role === 'admin' ? '#f59e0b' : '#8b5cf6',
                                borderColor: u.role === 'admin' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(139, 92, 246, 0.3)',
                                opacity: isSelf ? 0.5 : 1,
                                cursor: isSelf ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isUpdating
                                ? 'Updating...'
                                : u.role === 'admin'
                                ? 'Demote'
                                : 'Make Admin'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PLATFORM SERVICES (VIEW AS USER) */}
      {activeTab === 'services' && (
        <div className="admin-tab-content">
          {/* Service Filters */}
          <div
            className="filter-bar"
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: '1.25rem',
            }}
          >
            {/* Search */}
            <div className="search-input-wrap" style={{ position: 'relative', minWidth: '260px', flex: '1 1 260px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #71717a)' }} />
              <input
                type="text"
                placeholder="Search service name, target, user..."
                value={serviceSearchQuery}
                onChange={(e) => setServiceSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #27272a)',
                  background: 'var(--bg-card, #18181b)',
                  color: 'inherit',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            {/* User Filter Dropdown */}
            <select
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              style={{
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #27272a)',
                background: 'var(--bg-card, #18181b)',
                color: 'inherit',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Platform Users</option>
              {usersList.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>

            {/* Protocol Filter */}
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              style={{
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #27272a)',
                background: 'var(--bg-card, #18181b)',
                color: 'inherit',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Protocols</option>
              <option value="http">HTTP / REST</option>
              <option value="postgres">PostgreSQL</option>
              <option value="redis">Redis</option>
              <option value="cron">Cron Heartbeat</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              style={{
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #27272a)',
                background: 'var(--bg-card, #18181b)',
                color: 'inherit',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="up">UP Only</option>
              <option value="down">DOWN Only</option>
              <option value="pending">PENDING Only</option>
            </select>

            {/* Reset Filters button if any are active */}
            {(selectedUserFilter !== 'all' ||
              selectedTypeFilter !== 'all' ||
              selectedStatusFilter !== 'all' ||
              serviceSearchQuery) && (
              <button
                className="btn-secondary"
                onClick={() => {
                  setSelectedUserFilter('all');
                  setSelectedTypeFilter('all');
                  setSelectedStatusFilter('all');
                  setServiceSearchQuery('');
                }}
                style={{ padding: '0.55rem 0.85rem', fontSize: '0.8rem' }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Monitors Table */}
          <div className="admin-table-wrap" style={{ overflowX: 'auto', background: 'var(--bg-card, #18181b)', borderRadius: '12px', border: '1px solid var(--border-color, #27272a)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color, #27272a)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)' }}>Service</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)' }}>Owner (User)</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)' }}>Target Preview</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)' }}>Status</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)' }}>Interval</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)' }}>Last Checked</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-muted, #a1a1aa)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonitors.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted, #71717a)' }}>
                      No platform services match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredMonitors.map((m) => {
                    const isTesting = testingMonitorId === m.id;
                    const isDeleting = deletingMonitorId === m.id;

                    const protocolBadgeStyle = {
                      http: { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
                      postgres: { bg: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' },
                      redis: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' },
                      cron: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' },
                    }[m.type] || { bg: 'rgba(255,255,255,0.1)', color: '#fff' };

                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color, #27272a)' }}>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: protocolBadgeStyle.bg,
                                color: protocolBadgeStyle.color,
                              }}
                            >
                              {m.type}
                            </span>
                            <div>
                              <div style={{ fontWeight: 600 }}>{m.name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #71717a)' }}>ID: #{m.id}</div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <button
                            onClick={() => handleFilterByUser(m.userId)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              textAlign: 'left',
                              color: 'inherit',
                            }}
                          >
                            <div style={{ fontWeight: 500, color: 'var(--brand-primary, #6366f1)' }}>
                              {m.userName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #a1a1aa)' }}>
                              {m.userEmail}
                            </div>
                          </button>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem', maxWidth: '280px' }}>
                          <div
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              background: 'rgba(0,0,0,0.25)',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--text-muted, #cbd5e1)',
                            }}
                            title={m.targetPreview}
                          >
                            {m.targetPreview || '—'}
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <span
                            className={`status-badge status-${m.status}`}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background:
                                m.status === 'up'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : m.status === 'down'
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : 'rgba(245, 158, 11, 0.15)',
                              color:
                                m.status === 'up'
                                  ? '#10b981'
                                  : m.status === 'down'
                                  ? '#ef4444'
                                  : '#f59e0b',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: 'currentColor',
                              }}
                            />
                            {m.status.toUpperCase()}
                            {m.lastLatencyMs !== null && m.lastLatencyMs !== undefined && (
                              <span style={{ opacity: 0.8, fontSize: '0.7rem' }}>
                                ({m.lastLatencyMs}ms)
                              </span>
                            )}
                          </span>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.8rem' }}>{m.checkInterval}s</span>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #a1a1aa)' }}>
                            {timeAgo(m.lastCheckedAt)}
                          </span>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                            <button
                              className="btn-secondary"
                              onClick={() => handleTestMonitor(m.id)}
                              disabled={isTesting}
                              title="Trigger immediate probe test as admin"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Play size={12} className={isTesting ? 'spin-anim' : ''} />
                              <span>{isTesting ? 'Probing...' : 'Probe'}</span>
                            </button>

                            <button
                              className="btn-secondary text-red"
                              onClick={() => handleDeleteMonitor(m)}
                              disabled={isDeleting}
                              title="Delete service as admin"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CLUSTER & TELEMETRY */}
      {activeTab === 'cluster' && (
        <div className="admin-tab-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {/* Hash Ring Workers */}
            <div
              style={{
                background: 'var(--bg-card, #18181b)',
                borderRadius: '12px',
                border: '1px solid var(--border-color, #27272a)',
                padding: '1.5rem',
              }}
            >
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', margin: '0 0 1rem 0' }}>
                <Cpu size={18} style={{ color: '#8b5cf6' }} />
                <span>Consistent Hash Ring Worker Nodes</span>
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted, #a1a1aa)', marginBottom: '1.25rem' }}>
                Active probe runners participating in distributed workload partitioning. Heartbeat leases expire after 30 seconds.
              </p>

              {overview?.cluster?.activeWorkers?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {overview.cluster.activeWorkers.map((workerId, idx) => (
                    <div
                      key={workerId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600 }}>
                          {workerId}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                        Node #{idx + 1} • Registered
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted, #71717a)' }}>
                  No active workers registered on the ring. Probes run via default scheduler.
                </div>
              )}
            </div>

            {/* Pipeline Queues & DB Topology */}
            <div
              style={{
                background: 'var(--bg-card, #18181b)',
                borderRadius: '12px',
                border: '1px solid var(--border-color, #27272a)',
                padding: '1.5rem',
              }}
            >
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', margin: '0 0 1rem 0' }}>
                <Layers size={18} style={{ color: '#3b82f6' }} />
                <span>Asynchronous Pipeline Queues</span>
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted, #a1a1aa)', marginBottom: '1.25rem' }}>
                Redis write-behind buffers and message queue depths protecting database and notification channels.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Telemetry Write-behind Buffer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Telemetry Write-Behind Buffer</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #71717a)' }}>Key: telemetry:buffer</div>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#3b82f6' }}>
                    {overview?.cluster?.telemetryBufferDepth ?? 0} msgs
                  </span>
                </div>

                {/* Alert Broker Queue */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Alert Broker Queue</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #71717a)' }}>Key: alert:queue</div>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#10b981' }}>
                    {overview?.cluster?.alertQueueDepth ?? 0} msgs
                  </span>
                </div>

                {/* Dead Letter Queue */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Dead Letter Queue (DLQ)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #71717a)' }}>Key: alert:dlq</div>
                  </div>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '1rem',
                      color: overview?.cluster?.dlqDepth > 0 ? '#ef4444' : '#10b981',
                    }}
                  >
                    {overview?.cluster?.dlqDepth ?? 0} msgs
                  </span>
                </div>

                {/* Database Topology */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>PostgreSQL Topology</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #71717a)' }}>
                      Replication Mode
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: 'rgba(139, 92, 246, 0.15)',
                      color: '#a78bfa',
                      textTransform: 'uppercase',
                    }}
                  >
                    {overview?.cluster?.databaseTopology?.mode || 'primary-only'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
