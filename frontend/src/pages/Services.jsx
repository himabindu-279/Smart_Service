import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getServiceCategories } from '../api/client';
import { ArrowRight, Building2, Car, GraduationCap, HeartPulse, Home, Sparkles, Utensils } from 'lucide-react';

const GROUP_ICONS = {
  'home-services': Home,
  'healthcare': HeartPulse,
  'food-services': Utensils,
  'education': GraduationCap,
  'automotive': Car,
};

const DISPLAY_NAMES = {
  'Home Services': 'Home Service',
  'Healthcare': 'Healthcare',
  'Food Services': 'Food Service',
  'Education': 'Education',
  'Automotive': 'Automotive',
};

export default function Services() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoading(true);
        const data = await getServiceCategories();
        const allowed = ['home-services', 'healthcare', 'food-services', 'education', 'automotive'];
        const mapped = data.filter((category) => allowed.includes(category.slug));
        setCategories(mapped);
      } catch (err) {
        setError(err.message || 'Could not load service groups.');
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  return (
    <div className="container services-page-container" style={{ padding: '2.5rem 1.5rem 5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.8rem', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <Sparkles size={14} />
          Service marketplace
        </div>
        <h1 style={{ fontSize: '2.3rem', margin: '0.8rem 0 0.5rem' }}>Explore service groups</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '700px', lineHeight: 1.7 }}>
          Choose a service group to view only the relevant services and book the right professional for your needs.
        </p>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading service groups...
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#991b1b', background: '#fef2f2', borderColor: '#fecaca' }}>
          {error}
        </div>
      ) : categories.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No service groups are currently available.
        </div>
      ) : (
        <div className="services-horizontal-row" aria-label="Service groups">
          {categories.map((category) => {
            const Icon = GROUP_ICONS[category.slug] || Building2;
            const displayName = DISPLAY_NAMES[category.name] || category.name;
            const serviceCount = category.services?.length || 0;

            return (
              <Link
                key={category.id}
                to={`/services/${category.slug}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: '24px',
                  padding: '1.5rem',
                  boxShadow: '0 14px 30px rgba(15, 23, 42, 0.04)',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                }}
                className="service-group-card"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #dbeafe, #e0e7ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8' }}>
                    <Icon size={24} />
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '0.35rem 0.7rem', borderRadius: 999, background: '#f8fafc', color: 'var(--text-muted)', border: '1px solid var(--border)', fontWeight: 700 }}>
                    {serviceCount} service{serviceCount === 1 ? '' : 's'}
                  </span>
                </div>

                <h2 style={{ fontSize: '1.55rem', margin: '0 0 0.5rem' }}>{displayName}</h2>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, minHeight: '60px' }}>
                  {category.description || 'Explore trusted and verified professionals for this category.'}
                </p>

                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>View services</span>
                  <ArrowRight size={18} color="var(--primary)" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

