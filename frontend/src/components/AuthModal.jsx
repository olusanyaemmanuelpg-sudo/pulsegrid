import React, { useState } from 'react';
import { Github, Sparkles, User } from './Icons';
import { useAuth } from '../context/AuthContext';

export const AuthModal = ({ isOpen, onClose }) => {
  const { loginAsDemo, loginWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    loginWithEmail(email);
    onClose();
  };

  const handleGithub = () => {
    loginAsDemo();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content auth-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="auth-brand-badge">
              <Sparkles size={14} />
              <span>Open Source Cloud</span>
            </div>
            <h2 className="modal-title mt-1">Welcome to PulseGrid</h2>
            <p className="modal-subtitle">
              Sign in to manage multi-region probes, team alerts, and status pages.
            </p>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="auth-modal-body">
          {/* One-click GitHub OAuth button */}
          <button className="btn-github-oauth" onClick={handleGithub}>
            <Github size={18} />
            <span>Continue with GitHub</span>
          </button>

          <div className="auth-divider">
            <span>or sign in with email</span>
          </div>

          <form onSubmit={handleEmailSubmit} className="auth-email-form">
            <div className="form-group">
              <label className="form-label">Developer Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full">
              Sign In to Console
            </button>
          </form>

          {/* Quick Demo Access */}
          <div className="auth-demo-shortcut">
            <button
              type="button"
              className="btn-demo-login"
              onClick={() => {
                loginAsDemo();
                onClose();
              }}
            >
              <User size={15} />
              <span>Instant Test: Sign in as Emmanuel (Core Architect)</span>
            </button>
          </div>

          <p className="auth-terms">
            By continuing, you agree to PulseGrid's Open Source Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};
