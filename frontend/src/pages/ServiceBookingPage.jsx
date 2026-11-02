import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, getServiceCategories } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getServiceTask } from '../config/serviceCatalog';
import { ArrowLeft, CalendarCheck2, CheckCircle2, Clock3, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

const DISPLAY_NAMES = {
  'Home Services': 'Home Service',
  'Healthcare': 'Healthcare',
  'Food Services': 'Food Service',
  'Education': 'Education',
  'Automotive': 'Automotive',
};

export default function ServiceBookingPage() {
  const { categorySlug, serviceSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();

  const [category, setCategory] = useState(null);
  const [service, setService] = useState(null);
  const [providers, setProviders] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingResult, setBookingResult] = useState(null);
  const taskSlug = new URLSearchParams(location.search).get('task');
  const selectedTask = service ? getServiceTask(service.slug, taskSlug) : null;
  const bookingTitle = selectedTask?.title || service?.name;
  const [form, setForm] = useState({
    customerFullName: user?.full_name || '',
    customerMobile: user?.phone || '',
    customerEmail: user?.email || '',
    bookingDate: '',
    bookingTime: '10:00',
    serviceAddress: '',
    specialInstructions: '',
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      customerFullName: user?.full_name || current.customerFullName,
      customerMobile: user?.phone || current.customerMobile,
      customerEmail: user?.email || current.customerEmail,
    }));
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const loadServiceData = async () => {
      try {
        setLoading(true);
        setError('');

        const categories = await getServiceCategories();
        const matchCategory = categories.find((item) => item.slug === categorySlug);
        if (!matchCategory) {
          throw new Error('This service group is not available.');
        }

        const matchService = matchCategory.services.find((item) => item.slug === serviceSlug);
        if (!matchService) {
          throw new Error('This service is not available in the selected group.');
        }

        const providerData = await api.get('/providers', { service_id: matchService.id });

        if (!isMounted) return;

        setCategory(matchCategory);
        setService(matchService);
        setProviders(providerData);
        setSelectedProviderId(providerData[0]?.id || '');

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateString = tomorrow.toISOString().split('T')[0];
        setForm((current) => ({ ...current, bookingDate: dateString }));
      } catch (err) {
        if (isMounted) setError(err.message || 'Unable to load this service.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadServiceData();
    return () => { isMounted = false; };
  }, [categorySlug, serviceSlug]);

  const displayName = useMemo(() => {
    if (!category) return 'Service';
    return DISPLAY_NAMES[category.name] || category.name;
  }, [category]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const validateForm = () => {
    const customerName = form.customerFullName.trim();
    if (customerName.split(/\s+/).length < 2) {
      return 'Please enter the customer full name.';
    }

    const strippedNumber = form.customerMobile.replace(/\D/g, '');
    if (strippedNumber.length < 8 || strippedNumber.length > 15) {
      return 'Please enter a valid mobile number with 8 to 15 digits.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail.trim())) {
      return 'Please enter a valid email address.';
    }

    if (!form.bookingDate || !form.bookingTime) {
      return 'Please select a booking date and preferred time.';
    }

    const selectedDateTime = new Date(`${form.bookingDate}T${form.bookingTime}:00`);
    if (Number.isNaN(selectedDateTime.getTime()) || selectedDateTime <= new Date()) {
      return 'Please choose a future booking date and time.';
    }

    if (form.serviceAddress.trim().length < 5) {
      return 'Please provide a valid service address.';
    }

    if (!selectedProviderId) {
      return 'Please choose an available provider for this service.';
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        provider_id: Number(selectedProviderId),
        service_id: Number(service.id),
        customer_full_name: form.customerFullName.trim(),
        customer_mobile: form.customerMobile.trim(),
        customer_email: form.customerEmail.trim(),
        booking_date: form.bookingDate,
        booking_time: form.bookingTime,
        service_address: form.serviceAddress.trim(),
        special_instructions: form.specialInstructions.trim() || undefined,
      };

      const response = await api.post('/bookings', payload);
      setBookingResult(response);
    } catch (err) {
      setError(err.message || 'Unable to submit this booking.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem 5rem' }}>
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          {t('services.loadingDetails')}
        </div>
      </div>
    );
  }

  if (error && !service) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem 5rem' }}>
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#991b1b', marginBottom: '1rem' }}>{error}</p>
          <Link to="/services" className="btn btn-primary">{t('booking.backServices')}</Link>
        </div>
      </div>
    );
  }

  if (bookingResult) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem 5rem', maxWidth: '860px' }}>
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <CheckCircle2 size={56} color="#10b981" style={{ margin: '0 auto 1rem' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.85rem', borderRadius: 999, background: '#ecfdf5', color: '#047857', fontWeight: 700, marginBottom: '0.75rem' }}>
            <ShieldCheck size={16} />
            {t('booking.confirmed')}
          </div>

          <h1 style={{ marginBottom: '0.75rem' }}>{t('booking.saved')}</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            {t('booking.savedDescription')}
          </p>

          <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '18px', padding: '1.25rem', textAlign: 'left', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{t('booking.reference')}</div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{bookingResult.booking_reference}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{t('booking.status')}</div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{bookingResult.status}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{t('booking.service')}</div>
                <div style={{ fontWeight: 700 }}>{bookingResult.service_name}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{t('booking.provider')}</div>
                <div style={{ fontWeight: 700 }}>{bookingResult.provider_name}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/bookings" className="btn btn-primary">{t('booking.viewBookings')}</Link>
            <Link to="/services" className="btn btn-secondary">{t('booking.backServices')}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem', maxWidth: '1100px' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        <Link to="/services" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}>{t('common.services')}</Link>
        <span>›</span>
        <Link to={`/services/${categorySlug}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}>{displayName}</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{bookingTitle}</span>
      </nav>

      <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.8rem', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <Sparkles size={14} />
              {displayName}
            </div>
            <h1 style={{ margin: '1rem 0 0.5rem', fontSize: '2.3rem' }}>{bookingTitle}</h1>
            <p style={{ color: 'var(--text-muted)', maxWidth: '800px', lineHeight: 1.7, margin: 0 }}>
              {selectedTask?.description || service.description}
              {selectedTask && <span style={{ display: 'block', marginTop: '0.35rem' }}>              {t('booking.marketplaceService')}: {service.name}</span>}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('booking.startingFrom')}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--secondary)' }}>₹{Number(service.base_price || 0).toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{service.estimated_duration_minutes || 60} {t('booking.minutes')}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>{t('booking.availableProviders')}</h2>
            <Link to={`/services/${categorySlug}`} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
              <ArrowLeft size={15} />
              <span>{t('common.back')}</span>
            </Link>
          </div>

          {providers.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '18px', color: 'var(--text-muted)' }}>
              {t('services.noProviders')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedProviderId(String(provider.id))}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: selectedProviderId === String(provider.id) ? '#eff6ff' : '#f8fafc',
                    border: selectedProviderId === String(provider.id) ? '1px solid #bfdbfe' : '1px solid var(--border)',
                    borderRadius: '18px',
                    padding: '1rem',
                    cursor: 'pointer',
                    color: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                      <span>{provider.business_name}</span>
                      {provider.is_verified && <ShieldCheck size={16} color="#2563eb" />}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{provider.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                      <span>{t('booking.years', { count: provider.experience_years })}</span>
                      {provider.rating_avg > 0 && provider.total_ratings > 0
                        ? <span>{provider.rating_avg} ★ ({t('booking.reviews', { count: provider.total_ratings })})</span>
                        : <span>{t('booking.newProvider')}</span>}
                      {provider.distance_km != null && <span>{provider.distance_km} km away</span>}
                      {(provider.services?.find((item) => item.service_id === service.id)?.service_location || provider.address) && (
                        <span>{provider.services?.find((item) => item.service_id === service.id)?.service_location || provider.address}</span>
                      )}
                      {provider.services?.find((item) => item.service_id === service.id)?.availability && (
                        <span>{provider.services.find((item) => item.service_id === service.id).availability}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('common.from')}</div>
                    <div style={{ fontWeight: 800, color: 'var(--secondary)', fontSize: '1.2rem' }}>
                      {provider.services?.find((item) => item.service_id === service.id)?.custom_price != null
                        ? `₹${Number(provider.services.find((item) => item.service_id === service.id).custom_price).toLocaleString('en-IN')}`
                        : t('booking.priceOnRequest')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <CalendarCheck2 size={18} color="var(--primary)" />
            <h2 style={{ margin: 0 }}>{t('booking.bookService', { service: bookingTitle })}</h2>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>{t('booking.customerName')}</label>
              <input name="customerFullName" value={form.customerFullName} onChange={handleChange} required minLength={2} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>{t('booking.phone')}</label>
                <input name="customerMobile" type="tel" value={form.customerMobile} onChange={handleChange} required minLength={8} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>{t('booking.email')}</label>
                <input name="customerEmail" type="email" value={form.customerEmail} onChange={handleChange} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>{t('booking.date')}</label>
                <input name="bookingDate" type="date" value={form.bookingDate} onChange={handleChange} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>{t('booking.preferredTime')}</label>
                <select name="bookingTime" value={form.bookingTime} onChange={handleChange} required>
                  <option value="09:00">09:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="14:00">02:00 PM</option>
                  <option value="16:00">04:00 PM</option>
                  <option value="18:00">06:00 PM</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>{t('booking.serviceAddress')}</label>
              <input name="serviceAddress" type="text" value={form.serviceAddress} onChange={handleChange} placeholder={t('booking.addressPlaceholder')} required />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>{t('booking.instructions')}</label>
              <textarea name="specialInstructions" value={form.specialInstructions} onChange={handleChange} rows={3} placeholder={t('booking.instructionsPlaceholder')} />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <Link to={`/services/${categorySlug}`} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>{t('common.cancel')}</Link>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                {submitting ? t('booking.submitting') : t('booking.confirm')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
