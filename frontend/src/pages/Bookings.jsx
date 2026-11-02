import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Calendar, Clock, MapPin, CheckCircle, AlertCircle, Star, MessageSquare, X } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

export default function Bookings() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Review Modal State
  const [reviewBooking, setReviewBooking] = useState(null);
  const [reviewText, setReviewText] = useState('');
  const [ratingScore, setRatingScore] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = () => {
    setLoading(true);
    api.get('/bookings/my')
      .then(setBookings)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm(t('bookings.cancelConfirm'))) return;
    try {
      await api.patch(`/bookings/${bookingId}/status`, { status: 'CANCELLED' });
      fetchBookings();
    } catch (err) {
      alert(err.message || t('bookings.cancelError'));
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await api.post('/reviews', {
        booking_id: reviewBooking.id,
        score: ratingScore,
        review_text: reviewText
      });
      alert(t('bookings.reviewThanks'));
      setReviewBooking(null);
      setReviewText('');
      fetchBookings();
    } catch (err) {
      alert(err.message || t('bookings.reviewError'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACCEPTED':
        return <span className="badge badge-primary">{t('bookings.accepted')}</span>;
      case 'IN_PROGRESS':
        return <span className="badge badge-warning">{t('bookings.inProgress')}</span>;
      case 'COMPLETED':
        return <span className="badge badge-success">{t('bookings.completed')}</span>;
      case 'CANCELLED':
      case 'REJECTED':
        return <span className="badge badge-danger">{t(`bookings.${status.toLowerCase()}`)}</span>;
      case 'PENDING':
      default:
        return <span className="badge badge-warning">{t('bookings.pending')}</span>;
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem', maxWidth: '900px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{t('bookings.heading')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          {t('bookings.description')}
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          {t('bookings.loading')}
        </div>
      ) : bookings.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Calendar size={48} color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>{t('bookings.none')}</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            {t('bookings.noneDescription')}
          </p>
          <a href="/discover" className="btn btn-primary">{t('bookings.findServices')}</a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {bookings.map((b) => (
            <div key={b.id} className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{b.booking_reference}</span>
                    {getStatusBadge(b.status)}
                  </div>
                  <h3 style={{ fontSize: '1.3rem' }}>{b.service_name}</h3>
                  <div style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600 }}>
                    {t('booking.provider')}: {b.provider_name}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('bookings.totalPayable')}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--secondary)' }}>
                    ₹{b.total_amount}
                  </div>
                </div>
              </div>

              {/* Details strip */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                background: 'var(--bg-main)',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem',
                fontSize: '0.85rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                  <Calendar size={16} />
                  <span>{t('bookings.scheduled')}: <b>{b.booking_date}</b></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                  <Clock size={16} />
                  <span>{t('bookings.timeSlot')}: <b>{b.booking_time}</b></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                  <MapPin size={16} />
                  <span>{b.service_address}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                {b.status === 'PENDING' && (
                  <button
                    onClick={() => handleCancelBooking(b.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--danger)' }}
                  >
                    {t('bookings.cancelAppointment')}
                  </button>
                )}

                {b.status === 'COMPLETED' && !b.has_review && (
                  <button
                    onClick={() => setReviewBooking(b)}
                    className="btn btn-primary btn-sm"
                  >
                    <Star size={14} />
                    <span>{t('bookings.rateReview')}</span>
                  </button>
                )}

                {b.has_review && (
                  <span className="badge badge-success" style={{ alignSelf: 'center' }}>
                    ✓ {t('bookings.reviewed')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewBooking && (
        <div className="modal-backdrop" onClick={() => setReviewBooking(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.3rem' }}>{t('bookings.reviewTitle', { provider: reviewBooking.provider_name })}</h2>
              <button onClick={() => setReviewBooking(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  {t('bookings.rating')}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRatingScore(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.25rem'
                      }}
                    >
                      <Star
                        size={28}
                        fill={star <= ratingScore ? '#f59e0b' : 'none'}
                        color={star <= ratingScore ? '#f59e0b' : '#cbd5e1'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Your Feedback
                </label>
                <textarea
                  rows={4}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder={t('bookings.reviewPlaceholder')}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setReviewBooking(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {submittingReview ? t('booking.submitting') : t('bookings.submitReview')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
