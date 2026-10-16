import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MiniAssistant from './MiniAssistant';

export default function MainLayout() {
  const location = useLocation();
  const isMapPage = location.pathname.startsWith('/maps');

  return (
    <div className="app-layout">
      {/* Normal modules in LEFT SIDEBAR */}
      <Sidebar />

      {/* Main Right Area */}
      <div className="main-content" style={{ height: '100vh', overflow: isMapPage ? 'hidden' : 'auto' }}>
        {/* Top-Right Profile & Logout */}
        <Topbar />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Outlet />
        </div>

      </div>
      <MiniAssistant />
    </div>
  );
}

