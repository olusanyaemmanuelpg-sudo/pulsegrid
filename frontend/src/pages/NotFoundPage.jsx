import React from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Globe } from '../components/Icons';

export const NotFoundPage = () => {
  return (
    <div className="not-found-container">
      <div className="not-found-card">
        <div className="not-found-icon-wrap">
          <AlertTriangle size={36} className="text-yellow" />
        </div>
        <h1 className="not-found-title">404: Endpoint Not Found</h1>
        <p className="not-found-desc">
          The route you are looking for does not exist on this cluster or was moved during consensus resharding.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="btn-secondary">
            <Globe size={16} />
            <span>Go to Landing Page</span>
          </Link>
          <Link to="/dashboard" className="btn-primary">
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
