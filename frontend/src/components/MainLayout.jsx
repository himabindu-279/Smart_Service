import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';

export default function MainLayout() {
  return (
    <div className="app-layout">
      {/* Normal modules in LEFT SIDEBAR */}
      <Sidebar />

      {/* Main Right Area */}
      <div className="main-content">
        {/* Top-Right Profile & Logout */}
        <Topbar />

        <div style={{ flex: 1 }}>
          <Outlet />
        </div>

        <Footer />
      </div>
    </div>
  );
}
