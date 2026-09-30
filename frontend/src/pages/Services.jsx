import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Layers, Star, MapPin, ShieldCheck, ArrowRight, Tag } from 'lucide-react';

export default function Services() {
  const [categories, setCategories] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    api.get('/categories', { only_active_providers: true })
      .then((data) => {
        setCategories(data);
        const catParam = searchParams.get('category');
        if (catParam) {
          const found = data.find(c => String(c.id) === catParam);
          if (found && found.services?.length) {
            handleSelectService(found.services[0]);
          }
        } else if (data.length && data[0].services?.length) {
          handleSelectService(data[0].services[0]);
        }
      })
      .catch(console.error);
  }, []);

  const handleSelectService = async (service) => {
    setSelectedService(service);
    setLoadingProviders(true);
    try {
      const data = await api.get('/providers', {
        service_id: service.id
      });
      setProviders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProviders(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 4rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Service Directory</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Browse verified services by category. Select any service to explore registered specialists offering it.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: '2rem',
        alignItems: 'start'
      }}>
        {/* Left Column: Categories and Sub-Services */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {categories.map((cat) => (
            <div key={cat.id} className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{
                fontSize: '0.9rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Layers size={16} color="var(--primary)" />
                <span>{cat.name}</span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {cat.services?.map((svc) => {
                  const isSelected = selectedService?.id === svc.id;
                  return (
                    <button
                      key={svc.id}
                      onClick={() => handleSelectService(svc)}
                      style={{
                        textAlign: 'left',
                        padding: '0.6rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'var(--primary-light)' : 'transparent',
                        color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent'
                      }}
                    >
                      <span>{svc.name}</span>
                      <span style={{ fontSize: '0.8rem', color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                        ₹{svc.base_price}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Providers for selected service */}
        <div>
          {selectedService ? (
            <div>
              {/* Selected Service Banner */}
              <div className="card" style={{
                marginBottom: '1.75rem',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                borderLeft: '4px solid var(--primary)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <span className="badge badge-primary" style={{ marginBottom: '0.5rem' }}>Selected Service</span>
                    <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>{selectedService.name}</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '650px' }}>
                      {selectedService.description}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Base Price</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--secondary)' }}>
                      ₹{selectedService.base_price}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ~{selectedService.estimated_duration_minutes} mins duration
                    </div>
                  </div>
                </div>
              </div>

              {/* Providers Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem' }}>
                  Available Providers offering {selectedService.name} ({providers.length})
                </h3>
                <Link to={`/maps?service=${selectedService.id}`} className="btn btn-secondary btn-sm">
                  <MapPin size={15} />
                  <span>View on Map</span>
                </Link>
              </div>

              {/* Providers List */}
              {loadingProviders ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  Loading specialists...
                </div>
              ) : providers.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: 'var(--text-muted)' }}>
                    No providers currently listed for this service. Check nearby on the Maps tab.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {providers.map((p) => (
                    <div key={p.id} className="card" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1.5rem'
                    }}>
                      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '16px',
                          background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.4rem',
                          fontWeight: 700,
                          flexShrink: 0
                        }}>
                          {p.name[0]}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                            <h4 style={{ fontSize: '1.15rem' }}>{p.business_name}</h4>
                            {p.is_verified && <ShieldCheck size={18} color="var(--primary)" />}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                            {p.name} • {p.experience_years} years exp • {p.qualifications || 'Certified Professional'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#b45309', fontWeight: 600 }}>
                              <Star size={14} fill="#f59e0b" color="#f59e0b" />
                              <span>{p.rating_avg}</span>
                              <span>({p.total_ratings})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <MapPin size={14} />
                              <span>{p.distance_km ? `${p.distance_km} km away` : p.address}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginLeft: 'auto' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Starting from</div>
                          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--secondary)' }}>
                            ₹{p.services?.[0]?.custom_price || 500}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <Link to={`/providers/${p.id}`} className="btn btn-secondary btn-sm">
                            Profile
                          </Link>
                          <Link to={`/providers/${p.id}?book=true&service_id=${selectedService.id}`} className="btn btn-primary btn-sm">
                            Book Now
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>Select a service from the left menu to view providers.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
