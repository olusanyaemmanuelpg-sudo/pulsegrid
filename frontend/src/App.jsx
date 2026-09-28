import React, { useState } from 'react';
import { Routes, Route } from 'react-router';
import { MonitorProvider } from './context/MonitorContext';
import { Navbar } from './components/Navbar';
import { AddMonitorModal } from './components/AddMonitorModal';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { StatusPage } from './pages/StatusPage';
import './App.css';

function App() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <MonitorProvider>
      <div className="app-layout">
        <Navbar onOpenAddModal={() => setIsAddModalOpen(true)} />

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
      </div>
    </MonitorProvider>
  );
}

export default App;
