import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, UserCheck, MapPin, CalendarCheck } from 'lucide-react';

const featureCards = [
  { icon: ShieldCheck, title: 'Verified specialists', text: 'Only approved providers appear in the marketplace.' },
  { icon: MapPin, title: 'Local and near you', text: 'Browse services by location and proximity.' },
  { icon: CalendarCheck, title: 'Simple bookings', text: 'Book trusted assistance without leaving the app.' },
];

const serviceTiles = [
  'AC Repair',
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Doctor Consultation',
  'Home Food',
  'Tutors',
  'Car Repair',
];

export default function PublicHome() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f3f4f6 0%, #eef2ff 100%)',
      color: '#111827',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 1200 }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          marginBottom: 36,
          padding: '8px 4px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 24 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #3b82f6, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(59,130,246,0.25)',
            }}>
              <Sparkles size={18} />
            </div>
            <span>SmartServiceAI</span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: '#374151' }}>
            <Link to="/services" style={{ fontWeight: 600 }}>Services</Link>
            <Link to="/discover" style={{ fontWeight: 600 }}>Discover</Link>
            <Link to="/login" style={{ fontWeight: 600 }}>Login</Link>
            <Link to="/register" className="btn btn-primary" style={{ padding: '10px 18px', borderRadius: 999, fontWeight: 700 }}>Get Started</Link>
          </nav>
        </header>

        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: 30,
          boxShadow: '0 32px 80px rgba(15, 23, 42, 0.08)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.8fr',
            gap: 24,
            padding: '52px 56px',
            alignItems: 'center',
          }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#eff6ff',
                border: '1px solid #dbeafe',
                color: '#1d4ed8',
                borderRadius: 999,
                padding: '8px 12px',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                <StarBadge />
                Trusted home service marketplace
              </div>

              <h1 style={{ margin: '22px 0 16px', fontSize: 'clamp(2.5rem, 5vw, 5rem)', lineHeight: 1.02, letterSpacing: '-0.05em' }}>
                Reliable Home Services, Right at Your Doorstep
              </h1>

              <p style={{ marginBottom: 24, maxWidth: 560, color: '#475569', fontSize: 18, lineHeight: 1.7 }}>
                Book vetted local professionals for repairs, health support, cleaning, education, and more — powered by AI matching and real marketplace data.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 26 }}>
                <Link to="/services" className="btn btn-primary" style={{ padding: '14px 22px', borderRadius: 14, fontSize: 16, fontWeight: 700 }}>
                  Explore Services <ArrowRight size={18} />
                </Link>
                <Link to="/discover" className="btn btn-secondary" style={{ padding: '14px 22px', borderRadius: 14, fontSize: 16, fontWeight: 700 }}>
                  Discover Providers
                </Link>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', color: '#475569', fontSize: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MiniAvatar color="#60a5fa">A</MiniAvatar>
                  <MiniAvatar color="#f59e0b">J</MiniAvatar>
                  <MiniAvatar color="#34d399">M</MiniAvatar>
                </div>
                <span><strong style={{ color: '#0f172a' }}>4.9/5</strong> rated by 12k+ homeowners</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: '100%',
                maxWidth: 460,
                background: 'linear-gradient(135deg, #f8fafc, #eef2ff)',
                borderRadius: 28,
                padding: 24,
                border: '1px solid #e2e8f0',
                boxShadow: '0 18px 40px rgba(79,70,229,0.08)',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18 }}>
                  {serviceTiles.map((label, idx) => (
                    <div key={label} style={{
                      background: idx % 2 === 0 ? '#f8fafc' : '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: 18,
                      minHeight: 120,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: 14,
                      fontWeight: 700,
                      color: '#1f2937',
                    }}>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20, marginTop: 32 }}>
          {featureCards.map(({ icon: Icon, title, text }) => (
            <div key={title} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 24 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                <Icon size={24} />
              </div>
              <h3 style={{ margin: '18px 0 8px', fontSize: 22 }}>{title}</h3>
              <p style={{ color: '#475569', lineHeight: 1.7 }}>{text}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 42, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 28, padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
            <h2 style={{ fontSize: 'clamp(2rem, 3vw, 3rem)', lineHeight: 1.1, margin: 0 }}>Why customers choose us</h2>
            <Link to="/login" className="btn btn-primary" style={{ padding: '12px 20px', borderRadius: 12, fontWeight: 700 }}>
              Sign In to Book
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
            {[
              'On-time, vetted professionals',
              'Transparent service and price details',
              'Fast, safe booking flow for real appointments',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#111827', background: '#f8fafc', borderRadius: 16, padding: 16, border: '1px solid #e2e8f0' }}>
                <CheckCircle2 size={20} color="#10b981" />
                <span style={{ fontWeight: 600 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniAvatar({ children, color }) {
  return (
    <span style={{
      width: 28,
      height: 28,
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: color,
      color: '#fff',
      fontSize: 12,
      fontWeight: 700,
      boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
    }}>{children}</span>
  );
}

function StarBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.75l2.61 5.29 5.84.85-4.22 4.11 1 5.82-5.23-2.75-5.23 2.75 1-5.82-4.22-4.11 5.84-.85L12 2.75z" /></svg>
    </span>
  );
}
