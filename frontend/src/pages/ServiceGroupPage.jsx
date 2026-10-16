import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getServiceCategories } from '../api/client';
import { ArrowLeft, ArrowRight, Clock3, MapPin, Sparkles } from 'lucide-react';

const DISPLAY_NAMES = {
  'Home Services': 'Home Service',
  'Healthcare': 'Healthcare',
  'Food Services': 'Food Service',
  'Education': 'Education',
  'Automotive': 'Automotive',
};

export default function ServiceGroupPage() {
  const { categorySlug } = useParams();
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadCategory = async () => {
      try {
        setLoading(true);
        const categories = await getServiceCategories();
        const match = categories.find((item) => item.slug === categorySlug);
        if (!isMounted) return;

        if (!match) {
          setError('This service group is not available right now.');
          setCategory(null);
          return;
        }

        setCategory(match);
      } catch (err) {
        if (isMounted) setError(err.message || 'Could not load this service group.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCategory();
    return () => { isMounted = false; };
  }, [categorySlug]);

  const displayName = useMemo(() => {
    if (!category) return 'Service group';
    return DISPLAY_NAMES[category.name] || category.name;
  }, [category]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem 5rem' }}>
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading {categorySlug || 'services'}...
        </div>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem 5rem' }}>
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#991b1b', marginBottom: '1rem' }}>{error || 'Unable to find this category.'}</p>
          <Link to="/services" className="btn btn-primary">Back to Services</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container services-page-container" style={{ padding: '2.5rem 1.5rem 5rem', maxWidth: '1200px' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        <Link to="/services" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}>Services</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{displayName}</span>
      </nav>

      <div className="card" style={{ padding: '2rem', marginBottom: '2rem', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.8rem', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <Sparkles size={14} />
              {displayName}
            </div>
            <h1 style={{ margin: '1rem 0 0.5rem', fontSize: '2.1rem' }}>{displayName}</h1>
            <p style={{ color: 'var(--text-muted)', maxWidth: '760px', lineHeight: 1.7, margin: 0 }}>
              {category.description || 'Explore verified professionals and trusted specialists in this category.'}
            </p>
          </div>

          <Link to="/services" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.8rem 1rem' }}>
            <ArrowLeft size={16} />
            <span>Back to Services</span>
          </Link>
        </div>
      </div>

      <div className="services-horizontal-row" aria-label={`${displayName} services`}>
        {category.services?.length ? (
          category.services.map((service) => (
            <Link
              key={service.id}
              to={`/services/${category.slug}/${service.slug}`}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
                background: '#fff',
                border: '1px solid var(--border)',
                borderRadius: '22px',
                padding: '1.4rem',
                boxShadow: '0 12px 28px rgba(15, 23, 42, 0.04)',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.9rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8' }}>
                  <Sparkles size={20} />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>{service.active_providers_count || 0} providers</span>
              </div>

              <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>{service.name}</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, minHeight: '70px', margin: '0 0 1rem' }}>
                {service.description || 'Tailored specialist support for this service.'}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.9rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Starting from</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--secondary)' }}>₹{Number(service.base_price || 0).toLocaleString('en-IN')}</div>
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary)', fontWeight: 700 }}>
                  <span>Book now</span>
                  <ArrowRight size={16} />
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="card" style={{ padding: '2.5rem', textAlign: 'center', gridColumn: '1 / -1', color: 'var(--text-muted)' }}>
            No active services are available in this group right now.
          </div>
        )}
      </div>
    </div>
  );
}
