import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import { useAuth } from './context/AuthContext';
import Discover from './pages/Discover';
import Services from './pages/Services';
import ServiceGroupPage from './pages/ServiceGroupPage';
import ServiceBookingPage from './pages/ServiceBookingPage';
import Maps from './pages/Maps';
import Bookings from './pages/Bookings';
import AIAssistant from './pages/AIAssistant';
import ProviderDetail from './pages/ProviderDetail';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import PublicHome from './pages/PublicHome';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
        Checking your sign-in...
      </div>
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <MainLayout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />

      {/* Standalone Authentication Pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Main Layout with Left Sidebar & Top-Right Profile/Logout */}
      <Route element={<ProtectedLayout />}>
        <Route path="/discover" element={<Discover />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/:categorySlug" element={<ServiceGroupPage />} />
        <Route path="/services/:categorySlug/:serviceSlug" element={<ServiceBookingPage />} />
        <Route path="/maps" element={<Maps />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/assistant" element={<AIAssistant />} />
        <Route path="/providers/:id" element={<ProviderDetail />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Navigate to="/dashboard?tab=analytics" replace />} />
        <Route path="/provider" element={<Navigate to="/dashboard?tab=overview" replace />} />
        <Route path="*" element={<Navigate to="/discover" replace />} />
      </Route>
    </Routes>
  );
}
