import React from 'react';
import { Sparkles, Shield, Cpu, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{
      background: '#ffffff',
      borderTop: '1px solid var(--border)',
      marginTop: 'auto',
      padding: '3rem 0 2rem'
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '2.5rem',
          marginBottom: '2.5rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.75rem' }}>
              <Sparkles size={20} color="var(--primary)" />
              <span>SmartService AI</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              AI-Driven Smart Service Marketplace with personalized semantic recommendation, spatial provider matching, and intelligent review analytics.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Core AI Pipeline
            </h4>
            <ul style={{ listStyle: 'none', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>• BGE-M3 Semantic Service Understanding</li>
              <li>• BERT4Rec Sequential History Modeling</li>
              <li>• Heterogeneous Graph Transformer (HGT)</li>
              <li>• Cross-Encoder Deep Re-Ranking</li>
              <li>• DeBERTa-v3 Sentiment Quality Scoring</li>
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Service Domains
            </h4>
            <ul style={{ listStyle: 'none', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>• Home Services (Plumbing, AC, Electrical)</li>
              <li>• Healthcare & In-Home Nursing</li>
              <li>• Catering, Bakery & Home Food</li>
              <li>• Education & 1-on-1 Coding Tutors</li>
              <li>• Automotive & Two-Wheeler Care</li>
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Architecture
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              PostgreSQL Relational Storage • FastAPI High-Performance Backend • Leaflet & OpenStreetMap GIS • React Frontend.
            </p>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.85rem',
          color: 'var(--text-muted)'
        }}>
          <div>© 2026 SmartService AI. Final-Year B.Tech Project.</div>
          <div>All Machine Learning and GIS pipelines operate entirely on local inference.</div>
        </div>
      </div>
    </footer>
  );
}
