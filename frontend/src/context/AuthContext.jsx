import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
).replace(/\/+$/, '');
const USER_STORAGE_KEY = 'pulsegrid-user';
const TOKEN_STORAGE_KEY = 'pulsegrid-token';

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => {
    try {
      const user = localStorage.getItem(USER_STORAGE_KEY);
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      return user && token ? { user: JSON.parse(user), token } : null;
    } catch {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }
  });

  const authenticate = async (endpoint, credentials) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Authentication failed.');
    }
    if (!data.user || !data.token) {
      throw new Error('The server returned an invalid authentication response.');
    }

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setSession({ user: data.user, token: data.token });
    return data.user;
  };

  const login = (email, password) =>
    authenticate('login', { email, password });

  const register = (name, email, password) =>
    authenticate('register', { name, email, password });

  const logout = () => {
    setSession(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  };

  const value = {
    user: session?.user ?? null,
    token: session?.token ?? null,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
