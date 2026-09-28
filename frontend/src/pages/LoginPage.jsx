import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Activity, CheckCircle, Shield } from '../components/Icons';
import { useAuth } from '../context/AuthContext';

const chartHeights = [34, 48, 40, 62, 53, 72, 58, 80, 66, 89, 72, 96];

export const LoginPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loginWithEmail } = useAuth();
  const [mode, setMode] = useState(() =>
    new URLSearchParams(location.search).get('mode') === 'signup'
      ? 'signup'
      : 'signin',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Those passwords do not match.');
      return;
    }

    loginWithEmail(email, mode === 'signup' ? name : '');
    navigate(location.state?.from || '/dashboard', { replace: true });
  };

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link to="/" className="auth-brand">
          <span className="auth-brand-mark">
            <Activity size={19} />
          </span>
          <span>PulseGrid</span>
        </Link>
        <div className="auth-aside-copy">
          <span className="auth-eyebrow">MONITORING, IN CONTEXT</span>
          <h1>A clearer view of what keeps your product running.</h1>
          <p>
            Bring your endpoints, dependencies, and scheduled jobs into one
            workspace.
          </p>
        </div>
        <div className="auth-preview">
          <div className="auth-preview-heading">
            <div>
              <span>WORKSPACE ACTIVITY</span>
              <strong>Recent response time</strong>
            </div>
            <span className="auth-preview-status">
              <i /> Preview
            </span>
          </div>
          <div className="auth-chart" aria-hidden="true">
            {chartHeights.map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <div className="auth-preview-footer">
            <span>
              <CheckCircle size={15} /> Sample workspace ready
            </span>
            <span>12 checks</span>
          </div>
        </div>
        <div className="auth-aside-foot">
          <Shield size={15} /> A focused home for service health.
        </div>
      </aside>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-heading">
            <span className="auth-form-kicker">YOUR PULSEGRID WORKSPACE</span>
            <h2>
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h2>
            <p>
              {mode === 'signup'
                ? 'Start with a workspace for the services you care about.'
                : 'Sign in to continue to your monitoring workspace.'}
            </p>
          </div>

          <div
            className="auth-mode-switch"
            role="tablist"
            aria-label="Account access"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              className={mode === 'signin' ? 'active' : ''}
              onClick={() => {
                setMode('signin');
                setError('');
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => {
                setMode('signup');
                setError('');
              }}
            >
              Create account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <label className="auth-field">
                <span>Your name</span>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Jordan Lee"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
            )}
            <label className="auth-field">
              <span>Work email</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete={
                  mode === 'signup' ? 'new-password' : 'current-password'
                }
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            {mode === 'signup' && (
              <label className="auth-field">
                <span>Confirm password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Enter your password again"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </label>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="auth-submit">
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="auth-preview-note">
            Preview mode: this form creates a local demo session only. No
            credentials are sent to a server.
          </p>
          <p className="auth-mode-prompt">
            {mode === 'signup'
              ? 'Already have an account?'
              : 'New to PulseGrid?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signup' ? 'signin' : 'signup');
                setError('');
              }}
            >
              {mode === 'signup' ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
};
