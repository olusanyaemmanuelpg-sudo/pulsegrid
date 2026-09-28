import React, { useState } from 'react';
import { Routes, Route } from 'react-router';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { MonitorProvider } from './context/MonitorContext';
import { Navbar } from './components/Navbar';
import { AddMonitorModal } from './components/AddMonitorModal';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { StatusPage } from './pages/StatusPage';
import './App.css';

function App() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <ThemeProvider>
      <AuthProvider>
        <MonitorProvider>
          <div className="app-layout">
            <Navbar
              onOpenAddModal={() => setIsAddModalOpen(true)}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />

            <main className="main-content">
              <Routes>
                <Route
                  path="/"
                  element={<LandingPage onOpenAddModal={() => setIsAddModalOpen(true)} />}
                />
                <Route
                  path="/dashboard"
                  element={<DashboardPage onOpenAddModal={() => setIsAddModalOpen(true)} />}
                />
                <Route path="/status" element={<StatusPage />} />
              </Routes>
            </main>

            <AddMonitorModal
              isOpen={isAddModalOpen}
              onClose={() => setIsAddModalOpen(false)}
            />

            <AuthModal
              isOpen={isAuthModalOpen}
              onClose={() => setIsAuthModalOpen(false)}
            />
          </div>
        </MonitorProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
