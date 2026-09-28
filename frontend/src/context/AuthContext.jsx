import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('pulsegrid-user');
    return saved ? JSON.parse(saved) : null;
  });

  const loginAsDemo = () => {
    const demoUser = {
      name: 'Emmanuel',
      email: 'emmanuel@pulsegrid.dev',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
      role: 'Core Architect (Community Plan)'
    };
    setUser(demoUser);
    localStorage.setItem('pulsegrid-user', JSON.stringify(demoUser));
  };

  const loginWithEmail = (email) => {
    const newUser = {
      name: email.split('@')[0],
      email: email,
      avatar: null,
      role: 'Developer (Free Tier)'
    };
    setUser(newUser);
    localStorage.setItem('pulsegrid-user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('pulsegrid-user');
  };

  return (
    <AuthContext.Provider value={{ user, loginAsDemo, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
