import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MiniAssistant from './MiniAssistant';
import { I18nBoundary } from '../context/I18nContext';

export default function MainLayout() {
  const location = useLocation();
  const isMapPage = location.pathname.startsWith('/maps');

  return (
    <I18nBoundary>
      <div className="app-layout">
        <Sidebar />

        <div className="main-content" style={{ height: '100vh', overflow: isMapPage ? 'hidden' : 'auto' }}>
          <Topbar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Outlet />
          </div>
        </div>
        <MiniAssistant />
      </div>
    </I18nBoundary>
  );
}
