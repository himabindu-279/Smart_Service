import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Compass,
  Layers,
  MapPin,
  CalendarCheck,
  Sparkles,
  Bot,
  Shield,
  Briefcase,
  Users,
  LayoutDashboard,
  CheckSquare,
  Star,
  BarChart3,
  UserCheck
} from 'lucide-react';

export default function Sidebar() {
  const { user, isProvider, isAdmin } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab');

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div style={{
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          color: '#fff',
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(37,99,235,0.3)',
          flexShrink: 0
        }}>
          <Sparkles size={18} />
        </div>
        <div className="sidebar-text">
          <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--secondary)' }}>SmartService</span>
          <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--primary)', marginLeft: '2px' }}>AI</span>
        </div>
      </div>

      {/* Role-Based Navigation (Requirement 15) */}
      <nav className="sidebar-nav">
        {isAdmin ? (
          // ================= ADMIN NAVIGATION =================
          <>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.5rem 0.75rem 0.25rem' }}>
              Admin Control
            </div>

            <Link
              to="/dashboard?tab=analytics"
              className={`sidebar-link ${location.pathname === '/dashboard' && (!currentTab || currentTab === 'analytics') ? 'active' : ''}`}
            >
              <LayoutDashboard size={19} />
              <span className="sidebar-text">Dashboard</span>
            </Link>

            <Link
              to="/dashboard?tab=users"
              className={`sidebar-link ${location.pathname === '/dashboard' && currentTab === 'users' ? 'active' : ''}`}
            >
              <Users size={19} />
              <span className="sidebar-text">Users</span>
            </Link>

            <Link
              to="/dashboard?tab=providers"
              className={`sidebar-link ${location.pathname === '/dashboard' && currentTab === 'providers' ? 'active' : ''}`}
            >
              <UserCheck size={19} />
              <span className="sidebar-text">Providers</span>
            </Link>

            <Link
              to="/dashboard?tab=services"
              className={`sidebar-link ${location.pathname === '/dashboard' && currentTab === 'services' ? 'active' : ''}`}
            >
              <Layers size={19} />
              <span className="sidebar-text">Services</span>
            </Link>

            <Link
              to="/dashboard?tab=bookings"
              className={`sidebar-link ${location.pathname === '/dashboard' && currentTab === 'bookings' ? 'active' : ''}`}
            >
              <CalendarCheck size={19} />
              <span className="sidebar-text">Bookings</span>
            </Link>

            <Link
              to="/dashboard?tab=reviews"
              className={`sidebar-link ${location.pathname === '/dashboard' && currentTab === 'reviews' ? 'active' : ''}`}
            >
              <Star size={19} />
              <span className="sidebar-text">Reviews</span>
            </Link>

            <Link
              to="/dashboard?tab=analytics"
              className={`sidebar-link ${location.pathname === '/dashboard' && currentTab === 'analytics' ? 'active' : ''}`}
            >
              <BarChart3 size={19} />
              <span className="sidebar-text">Analytics</span>
            </Link>

            <div style={{ borderTop: '1px solid var(--border)', margin: '0.75rem 0' }} />

            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.25rem 0.75rem' }}>
              Marketplace View
            </div>

            <NavLink to="/discover" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Compass size={19} />
              <span className="sidebar-text">Discover</span>
            </NavLink>
            <NavLink to="/services" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Layers size={19} />
              <span className="sidebar-text">All Services</span>
            </NavLink>
            <NavLink to="/maps" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <MapPin size={19} />
              <span className="sidebar-text">Maps</span>
            </NavLink>
          </>
        ) : isProvider ? (
          // ================= PROVIDER NAVIGATION =================
          <>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.5rem 0.75rem 0.25rem' }}>
              Provider Portal
            </div>

            <Link
              to="/dashboard?tab=overview"
              className={`sidebar-link ${location.pathname === '/dashboard' && (!currentTab || currentTab === 'overview') ? 'active' : ''}`}
            >
              <LayoutDashboard size={19} />
              <span className="sidebar-text">Dashboard</span>
            </Link>

            <Link
              to="/dashboard?tab=services"
              className={`sidebar-link ${location.pathname === '/dashboard' && currentTab === 'services' ? 'active' : ''}`}
            >
              <Layers size={19} />
              <span className="sidebar-text">My Services</span>
            </Link>

            <Link
              to="/dashboard?tab=bookings"
              className={`sidebar-link ${location.pathname === '/dashboard' && currentTab === 'bookings' ? 'active' : ''}`}
            >
              <CalendarCheck size={19} />
              <span className="sidebar-text">Bookings</span>
            </Link>

            <Link
              to="/dashboard?tab=reviews"
              className={`sidebar-link ${location.pathname === '/dashboard' && currentTab === 'reviews' ? 'active' : ''}`}
            >
              <Star size={19} />
              <span className="sidebar-text">Reviews</span>
            </Link>

            <Link
              to="/dashboard?tab=profile"
              className={`sidebar-link ${location.pathname === '/dashboard' && currentTab === 'profile' ? 'active' : ''}`}
            >
              <Briefcase size={19} />
              <span className="sidebar-text">Profile</span>
            </Link>

            <div style={{ borderTop: '1px solid var(--border)', margin: '0.75rem 0' }} />

            <NavLink to="/discover" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Compass size={19} />
              <span className="sidebar-text">Discover</span>
            </NavLink>
            <NavLink to="/maps" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <MapPin size={19} />
              <span className="sidebar-text">Maps</span>
            </NavLink>
          </>
        ) : (
          // ================= CUSTOMER NAVIGATION =================
          <>
            <NavLink
              to="/discover"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Compass size={19} />
              <span className="sidebar-text">Discover</span>
            </NavLink>

            <NavLink
              to="/services"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Layers size={19} />
              <span className="sidebar-text">Services</span>
            </NavLink>

            <NavLink
              to="/maps"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <MapPin size={19} />
              <span className="sidebar-text">Maps</span>
            </NavLink>

            <NavLink
              to="/bookings"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <CalendarCheck size={19} />
              <span className="sidebar-text">Bookings</span>
            </NavLink>

            <NavLink
              to="/assistant"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Bot size={19} />
              <span className="sidebar-text">AI Assistant</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Sidebar Footer: Role card & Dashboard link */}
      {user && (
        <div className="sidebar-footer">
          <Link
            to="/dashboard"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: isProvider ? '#10b981' : (isAdmin ? '#7c3aed' : 'var(--primary)'),
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              fontWeight: 700,
              flexShrink: 0
            }}>
              {isAdmin ? <Shield size={16} /> : (isProvider ? <Briefcase size={16} /> : user.full_name?.[0]?.toUpperCase())}
            </div>
            <div className="sidebar-text" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.full_name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {user.role} Workspace
              </div>
            </div>
          </Link>
        </div>
      )}
    </aside>
  );
}
