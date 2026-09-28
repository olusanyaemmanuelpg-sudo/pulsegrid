import React, { createContext, useContext, useState } from 'react';

const MonitorContext = createContext();

const initialMonitors = [
  {
    id: 'mon-1',
    name: 'Production API (Railway)',
    type: 'http',
    target: 'https://api.myfintech.railway.app/health',
    status: 'up',
    latency: 84,
    uptime90d: 99.98,
    interval: 30,
    lastChecked: 'Just now',
    history: [95, 82, 88, 76, 92, 84, 80, 78, 85, 84],
    consecutiveFails: 0
  },
  {
    id: 'mon-2',
    name: 'Primary PostgreSQL Cluster',
    type: 'postgres',
    target: 'postgresql://db.railway.internal:5432/main',
    status: 'up',
    latency: 18,
    uptime90d: 100.0,
    interval: 60,
    lastChecked: '1m ago',
    history: [22, 19, 18, 17, 20, 19, 18, 18, 19, 18],
    consecutiveFails: 0
  },
  {
    id: 'mon-3',
    name: 'Session Cache (Redis)',
    type: 'redis',
    target: 'redis://cache.railway.internal:6379',
    status: 'up',
    latency: 4,
    uptime90d: 99.95,
    interval: 30,
    lastChecked: 'Just now',
    history: [5, 4, 4, 3, 5, 4, 4, 4, 3, 4],
    consecutiveFails: 0
  },
  {
    id: 'mon-4',
    name: 'Midnight DB Backup (Cron)',
    type: 'cron',
    target: 'https://pulsegrid.dev/ping/backup-7f89b',
    status: 'up',
    latency: 0,
    uptime90d: 100.0,
    interval: 86400,
    lastChecked: '4h ago',
    history: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    consecutiveFails: 0
  },
  {
    id: 'mon-5',
    name: 'Landing Page (Netlify CDN)',
    type: 'http',
    target: 'https://myfintech.netlify.app',
    status: 'down',
    latency: 0,
    uptime90d: 98.42,
    interval: 60,
    lastChecked: '30s ago',
    history: [110, 115, 0, 0, 0, 0, 0, 0, 0, 0],
    consecutiveFails: 3,
    error: '502 Bad Gateway: Bandwidth Limit Exceeded'
  }
];

export const MonitorProvider = ({ children }) => {
  const [monitors, setMonitors] = useState(initialMonitors);

  const addMonitor = (newMon) => {
    const monitorObj = {
      id: `mon-${Date.now()}`,
      ...newMon,
      status: 'up',
      latency: Math.floor(Math.random() * 80) + 20,
      uptime90d: 100.0,
      lastChecked: 'Just now',
      history: Array(10).fill(50).map(() => Math.floor(Math.random() * 60) + 30),
      consecutiveFails: 0
    };
    setMonitors([monitorObj, ...monitors]);
  };

  const deleteMonitor = (id) => {
    setMonitors(monitors.filter((m) => m.id !== id));
  };

  const testMonitor = (id) => {
    setMonitors(
      monitors.map((m) => {
        if (m.id === id) {
          const isUp = Math.random() > 0.15; // 85% chance up
          const newLatency = isUp ? Math.floor(Math.random() * 90) + 15 : 0;
          return {
            ...m,
            status: isUp ? 'up' : 'down',
            latency: newLatency,
            lastChecked: 'Just now',
            history: [...m.history.slice(1), newLatency],
            error: isUp ? null : 'Connection Timed Out (> 3000ms)'
          };
        }
        return m;
      })
    );
  };

  // Metrics
  const totalMonitors = monitors.length;
  const upMonitors = monitors.filter((m) => m.status === 'up').length;
  const downMonitors = monitors.filter((m) => m.status === 'down').length;
  const avgUptime = (
    monitors.reduce((acc, m) => acc + (m.uptime90d || 100), 0) / (totalMonitors || 1)
  ).toFixed(2);
  const activeLatencies = monitors.filter((m) => m.status === 'up' && m.latency > 0);
  const avgLatency = Math.round(
    activeLatencies.reduce((acc, m) => acc + m.latency, 0) / (activeLatencies.length || 1)
  );

  return (
    <MonitorContext.Provider
      value={{
        monitors,
        addMonitor,
        deleteMonitor,
        testMonitor,
        metrics: {
          total: totalMonitors,
          up: upMonitors,
          down: downMonitors,
          uptime: avgUptime,
          avgLatency
        }
      }}
    >
      {children}
    </MonitorContext.Provider>
  );
};

export const useMonitors = () => useContext(MonitorContext);
