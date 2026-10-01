import React, { useState } from 'react';
import { Link } from 'react-router';
import { Sparkles } from './Icons';
import { useAuth } from '../context/AuthContext';

export const AuthModal = ({ isOpen, onClose }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      onClose();
    } catch (authError) {
      setError(authError.message || 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content auth-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="auth-brand-badge">
              <Sparkles size={14} />
              <span>Open Source Cloud</span>
            </div>
            <h2 className="modal-title mt-1">Welcome to PulseGrid</h2>
            <p className="modal-subtitle">
              Sign in to manage multi-region probes, team alerts, and status
              pages.
            </p>
          </div>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="auth-modal-body">
          <div className="auth-divider">
            <span>or sign in with email</span>
          </div>

          <form onSubmit={handleEmailSubmit} className="auth-email-form">
            <div className="form-group">
              <label className="form-label">Developer Email</label>
              <input
                type="email"
                className="form-input"
                autoComplete="email"
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
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in…' : 'Sign In to Console'}
            </button>
          </form>

          <p className="auth-terms">
            New to PulseGrid?{' '}
            <Link to="/login?mode=signup" onClick={onClose}>
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
