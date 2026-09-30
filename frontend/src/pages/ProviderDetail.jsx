import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Star, MapPin, Calendar, Clock, ShieldCheck, CheckCircle2, MessageSquare, AlertCircle, X } from 'lucide-react';

export default function ProviderDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(searchParams.get('book') === 'true');

  // Booking Form State
  const [bookingServiceId, setBookingServiceId] = useState(searchParams.get('service_id') || '');
  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [bookingTime, setBookingTime] = useState('10:00');
  const [serviceAddress, setServiceAddress] = useState('14/B, 5th Cross, HSR Layout, Bengaluru');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/providers/${id}`)
      .then((data) => {
        setProvider(data);
        if (data.services?.length && !bookingServiceId) {
          setBookingServiceId(data.services[0].service_id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }

    setSubmitting(true);
    setBookingError('');
    try {
      await api.post('/bookings', {
        provider_id: Number(id),
        service_id: Number(bookingServiceId),
        booking_date: bookingDate,
        booking_time: bookingTime,
        service_address: serviceAddress,
        special_instructions: specialInstructions
      });
      setBookingSuccess(true);
      setTimeout(() => {
        setShowBookingModal(false);
        navigate('/bookings');
      }, 1500);
    } catch (err) {
      setBookingError(err.message || 'Failed to submit booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>Loading provider details...</div>;
  }

  if (!provider) {
    return <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>Provider not found.</div>;
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem', maxWidth: '1000px' }}>
      {/* Profile Overview Card */}
      <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            fontWeight: 800,
            boxShadow: 'var(--shadow-md)'
          }}>
            {provider.name[0]}
          </div>

          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h1 style={{ fontSize: '1.85rem' }}>{provider.business_name}</h1>
              {provider.is_verified && <ShieldCheck size={22} color="var(--primary)" title="Verified" />}
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1rem' }}>
              {provider.name} • {provider.experience_years} Years Industry Experience • {provider.qualifications}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#b45309', fontWeight: 700 }}>
                <Star size={18} fill="#f59e0b" color="#f59e0b" />
                <span>{provider.rating_avg}</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({provider.total_ratings} verified reviews)</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
                <MapPin size={18} />
                <span>{provider.address || 'Bengaluru'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#059669', fontWeight: 600 }}>
                <CheckCircle2 size={18} />
                <span>Available for Booking</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowBookingModal(true)}
                className="btn btn-primary"
                style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
              >
                Book This Specialist
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Details & Services */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        {/* Services Offered */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Services & Pricing</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {provider.services?.map((s) => (
              <div key={s.service_id} style={{
                padding: '1rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{s.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Est. Duration: {s.estimated_duration_minutes} mins
                  </div>
                  {s.experience_description && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {s.experience_description}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>₹{s.custom_price}</div>
                  <button
                    onClick={() => {
                      setBookingServiceId(s.service_id);
                      setShowBookingModal(true);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '0.35rem' }}
                  >
                    Select
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bio & Credentials */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>About Specialist</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            {provider.bio}
          </p>

          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Certifications & Experience</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <ShieldCheck size={16} color="var(--primary)" />
              <span>Background checked and police verified ID</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <CheckCircle2 size={16} color="var(--accent)" />
              <span>{provider.qualifications || 'Certified Professional'}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Clock size={16} color="var(--warning)" />
              <span>Punctual arrival with standard toolkits</span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reviews Section */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>Customer Reviews & Sentiment</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Reviews verified through completed bookings and analyzed using DeBERTa transformer sentiment scoring.
            </p>
          </div>
          <div className="badge badge-success">
            {provider.rating_avg} / 5.0 Average Score
          </div>
        </div>

        {provider.reviews?.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No reviews yet. Be the first to book and review!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {provider.reviews?.map((r) => (
              <div key={r.id} style={{
                padding: '1.25rem',
                background: 'var(--bg-main)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.user_name}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`badge ${r.sentiment === 'POSITIVE' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.75rem' }}>
                      Sentiment: {r.sentiment} ({((r.sentiment_score || 0.9) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
                <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  "{r.review_text}"
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="modal-backdrop" onClick={() => setShowBookingModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.4rem' }}>Book Service Appointment</h2>
              <button onClick={() => setShowBookingModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem' }}>
                <X size={18} />
              </button>
            </div>

            {bookingSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ marginBottom: '0.5rem' }}>Booking Confirmed!</h3>
                <p style={{ color: 'var(--text-muted)' }}>Redirecting to your Bookings dashboard...</p>
              </div>
            ) : (
              <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {bookingError && (
                  <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                    {bookingError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Select Service
                  </label>
                  <select
                    value={bookingServiceId}
                    onChange={(e) => setBookingServiceId(e.target.value)}
                    required
                  >
                    {provider.services?.map((s) => (
                      <option key={s.service_id} value={s.service_id}>
                        {s.name} - ₹{s.custom_price}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Date
                    </label>
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Time Slot
                    </label>
                    <select
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      required
                    >
                      <option value="09:00">09:00 AM</option>
                      <option value="11:00">11:00 AM</option>
                      <option value="14:00">02:00 PM</option>
                      <option value="16:00">04:00 PM</option>
                      <option value="18:00">06:00 PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Service Address
                  </label>
                  <input
                    type="text"
                    value={serviceAddress}
                    onChange={(e) => setServiceAddress(e.target.value)}
                    placeholder="House/Flat number, Street, Area"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Special Instructions (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="Describe specific issue details, landmark, etc."
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowBookingModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    {submitting ? 'Confirming...' : 'Confirm Appointment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
