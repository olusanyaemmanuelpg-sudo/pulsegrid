import React, { useState } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { MonitorProvider } from './context/MonitorContext';
import { Navbar } from './components/Navbar';
import { AddMonitorModal } from './components/AddMonitorModal';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { StatusPage } from './pages/StatusPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { useAuth } from './context/AuthContext';
import './App.css';

const ProtectedDashboard = ({ onOpenAddModal }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <DashboardPage onOpenAddModal={onOpenAddModal} />;
};

function App() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <ThemeProvider>
      <AuthProvider>
        <MonitorProvider>
          <div className="app-layout">
            <Navbar onOpenAddModal={() => setIsAddModalOpen(true)} />

            <main className="main-content">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedDashboard
                      onOpenAddModal={() => setIsAddModalOpen(true)}
                    />
                  }
                />
                <Route path="/status" element={<StatusPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>

            <AddMonitorModal
              isOpen={isAddModalOpen}
              onClose={() => setIsAddModalOpen(false)}
            />
          </div>
        </MonitorProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
