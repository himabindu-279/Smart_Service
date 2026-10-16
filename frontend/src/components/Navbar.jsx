import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Compass, Layers, MapPin, CalendarCheck, User, LogOut, LogIn, Sparkles, Shield } from 'lucide-react';

export default function Navbar() {
  const { user, logout, isAdmin, isProvider } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header style={{
      background: '#ffffff',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '70px'
      }}>
        {/* Brand Logo */}
        <Link to="/discover" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          color: 'var(--secondary)',
          fontWeight: 800,
          fontSize: '1.25rem',
          textDecoration: 'none'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(37,99,235,0.3)'
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <span>SmartService</span>
            <span style={{ color: 'var(--primary)', marginLeft: '2px' }}>AI</span>
          </div>
        </Link>

        {/* Main Navigation (Discover, Services, Maps, Bookings) */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <NavLink
            to="/discover"
            className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none', background: ({ isActive }) => isActive ? 'var(--primary)' : 'transparent' }}
          >
            <Compass size={17} />
            <span>Discover</span>
          </NavLink>

          <NavLink
            to="/services"
            className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            <Layers size={17} />
            <span>Services</span>
          </NavLink>

          <NavLink
            to="/maps"
            className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            <MapPin size={17} />
            <span>Maps</span>
          </NavLink>

          {user && (
            <NavLink
              to="/bookings"
              className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
            >
              <CalendarCheck size={17} />
              <span>Bookings</span>
            </NavLink>
          )}
        </nav>

        {/* User Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user ? (
            <>
              <Link to="/dashboard" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-main)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                color: 'var(--text-main)',
                fontSize: '0.875rem',
                fontWeight: 600
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: isProvider ? '#10b981' : (isAdmin ? '#7c3aed' : 'var(--primary)'),
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem'
                }}>
                  {isAdmin ? <Shield size={14} /> : user.full_name?.[0]?.toUpperCase()}
                </div>
                <span>{user.full_name?.split(' ')[0]}</span>
                <span className={`badge ${isProvider ? 'badge-success' : (isAdmin ? 'badge-primary' : 'badge-primary')}`} style={{ fontSize: '0.7rem' }}>
                  {user.role}
                </span>
              </Link>

              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                title="Log Out"
                style={{ padding: '0.5rem' }}
              >
                <LogOut size={16} />
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
      </div>
    </header>
  );
}
