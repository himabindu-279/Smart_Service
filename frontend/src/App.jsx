import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import Discover from './pages/Discover';
import Services from './pages/Services';
import Maps from './pages/Maps';
import Bookings from './pages/Bookings';
import AIAssistant from './pages/AIAssistant';
import ProviderDetail from './pages/ProviderDetail';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';

export default function App() {
  return (
    <Routes>
      {/* Standalone Authentication Pages (Section 1 requirement) */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Main Layout with Left Sidebar & Top-Right Profile/Logout */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Navigate to="/discover" replace />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/services" element={<Services />} />
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
