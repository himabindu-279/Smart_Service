import React from 'react';
import { Sparkles } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{
      background: '#ffffff',
      borderTop: '1px solid var(--border)',
      marginTop: 'auto',
      padding: '1.25rem 0'
    }}>
      <div className="container">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
            <Sparkles size={16} color="var(--primary)" />
            <span>SmartService AI</span>
          </div>
          <div>© 2026 SmartService AI</div>
        </div>
      </div>
    </footer>
  );
}
