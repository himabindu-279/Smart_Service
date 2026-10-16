import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, LogIn, Shield, Briefcase } from 'lucide-react';

export default function Topbar() {
  const { user, logout, isProvider, isAdmin, sessionError } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      {/* Left: Quick system indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
          <span>{sessionError || 'Smart Service Marketplace Live'}</span>
        </div>
      </div>

      {/* Top-Right: Profile and Logout (Section 1 requirement) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user ? (
          <>
            <Link
              to="/dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                textDecoration: 'none',
                color: 'var(--text-main)',
                fontSize: '0.875rem',
                fontWeight: 600,
                background: 'var(--bg-main)',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: isProvider ? '#10b981' : (isAdmin ? '#7c3aed' : 'var(--primary)'),
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem'
              }}>
                {isAdmin ? <Shield size={13} /> : user.full_name?.[0]?.toUpperCase()}
              </div>
              <span>Profile ({user.role})</span>
            </Link>

            <button
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to="/login" className="btn btn-secondary btn-sm">
              <LogIn size={15} />
              <span>Log In</span>
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              <span>Sign Up</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
