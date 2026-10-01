import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { useAuth } from './AuthContext';

const MonitorContext = createContext();

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

// Formats timestamp into "Just now", "2m ago", etc.
const formatTimeAgo = (dateString) => {
  if (!dateString) return 'Never';
  const diffSec = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000,
  );
  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

// Normalizes database row to frontend UI expectations
const normalizeMonitor = (m) => {
  const recentChecks = Array.isArray(m.recent_checks) ? m.recent_checks : [];
  const totalChecks = recentChecks.length;
  const upChecks = recentChecks.filter((c) => c.status === 'up').length;
  const realUptime =
    totalChecks > 0
      ? Number(((upChecks / totalChecks) * 100).toFixed(1))
      : m.status === 'up'
      ? 100.0
      : m.status === 'pending'
      ? 100.0
      : 0.0;

  return {
    ...m,
    latency: m.last_latency_ms ?? 0,
    interval: m.check_interval ?? 30,
    uptime90d: realUptime,
    lastChecked: formatTimeAgo(m.last_checked_at),
    history: recentChecks.map((c) => c.latency_ms ?? 0),
    recentChecks,
  };
};

export const MonitorProvider = ({ children }) => {
  const { token } = useAuth();
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch monitors from PostgreSQL via API (authenticated or public status)
  const fetchMonitors = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);

      try {
        const endpoint = token ? '/api/monitors' : '/api/status';
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          headers,
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch monitors.');
        }

        setMonitors((data.monitors || []).map(normalizeMonitor));
        setError(null);
      } catch (err) {
        console.error('Fetch monitors error:', err.message);
        setError(err.message);
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [token],
  );

  // Initial load + 10s auto-refresh polling
  useEffect(() => {
    fetchMonitors();

    const intervalId = setInterval(() => {
      fetchMonitors(true); // Silent background refresh
    }, 10000);

    return () => clearInterval(intervalId);
  }, [fetchMonitors]);

  // Add Monitor (POST /api/monitors)
  const addMonitor = async (newMon) => {
    if (!token) throw new Error('You must be logged in to create a monitor.');

    const response = await fetch(`${API_BASE_URL}/api/monitors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newMon),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create monitor.');
    }

    const created = normalizeMonitor(data.monitor);
    setMonitors((prev) => [created, ...prev]);
    return created;
  };

  // Delete Monitor (DELETE /api/monitors/:id)
  const deleteMonitor = async (id) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/monitors/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to delete monitor.');
      }

      setMonitors((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Delete monitor error:', err.message);
    }
  };

  // Test Monitor On-Demand (POST /api/monitors/:id/test)
  const testMonitor = async (id) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/monitors/${id}/test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'On-demand test failed.');
      }

      setMonitors((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                ...normalizeMonitor(data.monitor),
                error: data.error,
              }
            : m,
        ),
      );
    } catch (err) {
      console.error('Test monitor error:', err.message);
    }
  };

  // Metrics calculations
  const totalMonitors = monitors.length;
  const upMonitors = monitors.filter((m) => m.status === 'up').length;
  const downMonitors = monitors.filter((m) => m.status === 'down').length;
  const avgUptime = (
    monitors.reduce((acc, m) => acc + (m.uptime90d || 100), 0) /
    (totalMonitors || 1)
  ).toFixed(2);
  const activeLatencies = monitors.filter(
    (m) => m.status === 'up' && m.latency > 0,
  );
  const avgLatency = Math.round(
    activeLatencies.reduce((acc, m) => acc + m.latency, 0) /
      (activeLatencies.length || 1),
  );

  return (
    <MonitorContext.Provider
      value={{
        monitors,
        loading,
        error,
        fetchMonitors,
        addMonitor,
        deleteMonitor,
        testMonitor,
        metrics: {
          total: totalMonitors,
          up: upMonitors,
          down: downMonitors,
          uptime: avgUptime,
          avgLatency,
        },
      }}
    >
      {children}
    </MonitorContext.Provider>
  );
};

export const useMonitors = () => useContext(MonitorContext);
