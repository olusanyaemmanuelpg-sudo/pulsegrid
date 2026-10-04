const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3000' : '')
).replace(/\/+$/, '');

const authHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

export const getAdminOverview = async (token) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/overview`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch admin overview');
  }
  return res.json();
};

export const getAdminUsers = async (token) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch admin users');
  }
  return res.json();
};

export const getAdminMonitors = async (token, params = {}) => {
  const query = new URLSearchParams();
  if (params.userId) query.set('userId', params.userId);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.type && params.type !== 'all') query.set('type', params.type);
  if (params.search) query.set('search', params.search);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/api/admin/monitors${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch admin monitors');
  }
  return res.json();
};

export const updateUserRole = async (token, userId, role) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to update user role');
  }
  return res.json();
};

export const testMonitorAsAdmin = async (token, monitorId) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/monitors/${monitorId}/test`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to execute manual probe');
  }
  return res.json();
};

export const deleteMonitorAsAdmin = async (token, monitorId) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/monitors/${monitorId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to delete monitor');
  }
  return res.json();
};
