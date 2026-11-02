import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, User, Briefcase, Shield } from 'lucide-react';
import { api } from '../api/client';
import LocationPicker from '../components/LocationPicker';
import { I18nBoundary, useI18n } from '../context/I18nContext';
import LanguageSelector from '../components/LanguageSelector';

function RegisterContent() {
  const { t } = useI18n();
  const [role, setRole] = useState('USER');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Provider specific fields
  const [businessName, setBusinessName] = useState('');
  const [experienceYears, setExperienceYears] = useState(3);
  const [qualifications, setQualifications] = useState('');
  const [bio, setBio] = useState('');
  const [providerLocation, setProviderLocation] = useState({ address: '', latitude: null, longitude: null, radius_km: 15 });
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [availability, setAvailability] = useState('Monday - Saturday, 9:00 AM - 7:00 PM');
  const [offeredServices, setOfferedServices] = useState([]);
  const [identityDocument, setIdentityDocument] = useState(null);
  const [qualificationDocument, setQualificationDocument] = useState(null);
  const [emailCode, setEmailCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingEmailCode, setSendingEmailCode] = useState(false);

  useEffect(() => {
    if (role !== 'PROVIDER') return;
    api.get('/categories')
      .then(setCategories)
      .catch((err) => setError(err.message || 'Could not load the service catalog.'));
  }, [role]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedNext = new URLSearchParams(location.search).get('next');
  const nextPath = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/discover';
  const adminNextPath = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/dashboard?tab=analytics';
  const availableServices = categories
    .filter((category) => !selectedCategoryId || String(category.id) === selectedCategoryId)
    .flatMap((category) => category.services.map((service) => ({
      ...service,
      category_id: category.id,
      category_name: category.name,
    })));

  const sendVerificationCode = async () => {
    setSendingEmailCode(true);
    setError('');
    try {
      await api.post('/auth/provider-email-challenge', { email });
      setError(t('auth.codeSent'));
    } catch (err) {
      setError(err.message || 'Could not send the verification code.');
    } finally {
      setSendingEmailCode(false);
    }
  };

  const verifyProviderEmail = async () => {
    setError('');
    try {
      await api.post('/auth/provider-email-verify', { email, code: emailCode });
      setEmailVerified(true);
      setError('Email address verified.');
    } catch (err) {
      setError(err.message || 'Email verification failed.');
    }
  };

  const addOfferedService = () => {
    const selected = availableServices.find((service) => String(service.id) === selectedServiceId);
    if (!selected || !offerPrice || Number(offerPrice) <= 0) {
      setError('Select a catalog service and enter its price.');
      return;
    }
    if (offeredServices.some((service) => service.service_id === selected.id)) {
      setError('That service has already been added.');
      return;
    }
    setOfferedServices((current) => [...current, {
      service_id: selected.id,
      service_name: selected.name,
      category_name: selected.category_name,
      base_price: Number(offerPrice),
    }]);
    setSelectedServiceId('');
    setOfferPrice('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (role === 'ADMIN') {
      try {
        const authenticatedUser = await login(email, password, role);
        if (authenticatedUser.role !== 'ADMIN') {
          logout();
          throw new Error('This account does not have administrator access.');
        }
        navigate(adminNextPath);
      } catch (err) {
        setError(err.message || 'Administrator sign-in failed. Check your credentials.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (role === 'PROVIDER') {
      const requiredFiles = [identityDocument, qualificationDocument];
      const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
      if (!emailVerified) {
        setError('Verify your email address before provider registration.');
        setLoading(false);
        return;
      }
      if (!phone.trim() || !providerLocation.address || providerLocation.latitude == null || providerLocation.longitude == null) {
        setError('Enter your phone number and choose a provider address on the map.');
        setLoading(false);
        return;
      }
      if (!offeredServices.length || !identityDocument || !qualificationDocument) {
        setError('Add at least one service and upload both required verification documents.');
        setLoading(false);
        return;
      }
      if (requiredFiles.some((file) => file.size > 8 * 1024 * 1024 || (file.type && !allowedTypes.has(file.type)))) {
        setError('Each verification document must be a PDF, JPEG, or PNG no larger than 8 MB.');
        setLoading(false);
        return;
      }
    }

    const payload = {
      full_name: fullName,
      email,
      phone,
      password,
      role,
    };

    if (role === 'PROVIDER') {
      payload.business_name = businessName || fullName;
      payload.experience_years = Number(experienceYears);
      payload.qualifications = qualifications;
      payload.bio = bio;
      payload.address = providerLocation.address;
      payload.latitude = providerLocation.latitude;
      payload.longitude = providerLocation.longitude;
      payload.offered_services = offeredServices.map((service) => ({
        service_id: service.service_id,
        base_price: service.base_price,
        description: bio || null,
        service_location: providerLocation.address,
        service_radius_km: Number(providerLocation.radius_km || 15),
        availability_hours: availability,
        latitude: providerLocation.latitude,
        longitude: providerLocation.longitude,
      }));
    }

    try {
      await register(payload);
      if (role === 'PROVIDER') {
        try {
          for (const [documentType, file] of [
            ['IDENTITY', identityDocument],
            ['SERVICE_QUALIFICATION', qualificationDocument],
          ]) {
            const formData = new FormData();
            formData.append('document_type', documentType);
            formData.append('upload', file);
            await api.post('/providers/me/documents', formData);
          }
          navigate('/dashboard?tab=overview&providerApplication=submitted');
        } catch (uploadError) {
          window.alert(`Your provider account was created, but document upload needs to be completed in your dashboard: ${uploadError.message}`);
          navigate('/dashboard?tab=overview');
        }
      } else {
        navigate(nextPath);
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div className="auth-mark" style={{
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <UserPlus size={24} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <Link to="/" className="auth-back-link">← SmartServiceAI</Link>
            <LanguageSelector />
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{role === 'ADMIN' ? t('auth.adminSignIn') : t('auth.createAccount')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {role === 'ADMIN' ? t('auth.loginDescription') : t('auth.registerDescription')}
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '0.5rem',
          background: 'var(--bg-main)',
          padding: '0.35rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem'
        }}>
          <button
            type="button"
            onClick={() => { setRole('USER'); setError(''); }}
            style={{
              padding: '0.6rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.85rem',
              background: role === 'USER' ? '#ffffff' : 'transparent',
              color: role === 'USER' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: role === 'USER' ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <User size={16} />
            <span>{t('auth.customer')}</span>
          </button>

          <button
            type="button"
            onClick={() => { setRole('PROVIDER'); setError(''); }}
            style={{
              padding: '0.6rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.85rem',
              background: role === 'PROVIDER' ? '#ffffff' : 'transparent',
              color: role === 'PROVIDER' ? '#10b981' : 'var(--text-muted)',
              boxShadow: role === 'PROVIDER' ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <Briefcase size={16} />
            <span>{t('auth.serviceProvider')}</span>
          </button>

          <button
            type="button"
            onClick={() => { setRole('ADMIN'); setError(''); }}
            style={{
              padding: '0.6rem 0.35rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.85rem',
              background: role === 'ADMIN' ? '#ffffff' : 'transparent',
              color: role === 'ADMIN' ? '#7c3aed' : 'var(--text-muted)',
              boxShadow: role === 'ADMIN' ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              minWidth: 0,
            }}
          >
            <Shield size={16} />
            <span>{t('auth.administrator')}</span>
          </button>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-light)',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {role !== 'ADMIN' && <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              {t('auth.name')}
            </label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>}

          <div style={{ display: 'grid', gridTemplateColumns: role === 'ADMIN' ? '1fr' : '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                {t('auth.email')}
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailVerified(false);
                  setEmailCode('');
                }}
                required
              />
              {role === 'PROVIDER' && (
                <div className="provider-email-verification">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={sendVerificationCode} disabled={sendingEmailCode || !email}>
                    {sendingEmailCode ? t('auth.sending') : t('auth.sendCode')}
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder={t('auth.emailCode')}
                    value={emailCode}
                    onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ''))}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={verifyProviderEmail} disabled={emailCode.length !== 6}>
                    {t('auth.verifyCode')}
                  </button>
                  <span role="status">{emailVerified ? t('auth.verified') : t('auth.emailRequired')}</span>
                </div>
              )}
            </div>
            {role !== 'ADMIN' && <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                {t('auth.phoneNumber')}
              </label>
              <input
                type="tel"
                placeholder="+91-9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required={role === 'PROVIDER'}
              />
            </div>}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              {t('auth.password')}
            </label>
            <input
              type="password"
              placeholder={t('auth.enterPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Provider Specific Profile Fields */}
          {role === 'PROVIDER' && (
            <div style={{
              background: 'var(--bg-main)',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginTop: '0.5rem'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>
                {t('auth.providerProfile')}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                  {t('auth.tradeName')}
                </label>
                <input
                  type="text"
                  placeholder={t('auth.businessNamePlaceholder')}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                    {t('auth.yearsExperienceLabel')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                    {t('auth.qualifications')}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Certified HVAC Technician"
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                  />
                </div>
              </div>

              <LocationPicker
                value={providerLocation}
                onChange={setProviderLocation}
                label={t('auth.locationCoverage')}
              />

              <div className="provider-registration-services">
                <h3>{t('auth.servicesPricing')}</h3>
                <div className="provider-registration-service-row">
                  <select
                    value={selectedCategoryId}
                    onChange={(event) => {
                      setSelectedCategoryId(event.target.value);
                      setSelectedServiceId('');
                    }}
                  >
                    <option value="">{t('auth.allCategories')}</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <select value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)}>
                    <option value="">{t('auth.selectService')}</option>
                    {availableServices.map((service) => (
                      <option key={service.id} value={service.id}>{service.category_name} — {service.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder={t('auth.price')}
                    value={offerPrice}
                    onChange={(event) => setOfferPrice(event.target.value)}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addOfferedService}>{t('auth.addService')}</button>
                </div>
                {offeredServices.map((service) => (
                  <div key={service.service_id} className="provider-registration-service">
                    <span>{service.category_name} · {service.service_name} · ₹{service.base_price}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setOfferedServices((current) => current.filter((item) => item.service_id !== service.service_id))}
                    >
                      {t('auth.remove')}
                    </button>
                  </div>
                ))}
                <label>
                  {t('auth.availability')}
                  <input value={availability} onChange={(event) => setAvailability(event.target.value)} required />
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                  {t('auth.bio')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('auth.serviceDescription')}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>

              <div className="provider-registration-documents">
                <h3>{t('auth.documents')}</h3>
                <label>
                  {t('auth.identityDocument')}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required onChange={(event) => setIdentityDocument(event.target.files?.[0] || null)} />
                </label>
                <label>
                  {t('auth.serviceQualification')}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required onChange={(event) => setQualificationDocument(event.target.files?.[0] || null)} />
                </label>
                <p>{t('auth.privateDocuments')}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (role === 'PROVIDER' && !emailVerified)}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
          >
            {loading ? (role === 'ADMIN' ? t('auth.signingIn') : t('auth.creatingAccount')) : role === 'ADMIN' ? t('auth.adminSignIn') : t('auth.registerAs', { role: role === 'PROVIDER' ? t('auth.serviceProvider') : t('auth.customer') })}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {role === 'ADMIN' ? <>{t('auth.noAccount')} <Link to="/login" style={{ fontWeight: 600 }}>{t('auth.goToLogin')}</Link></> : <>{t('auth.alreadyAccount')} <Link to="/login" style={{ fontWeight: 600 }}>{t('auth.signIn')}</Link></>}
        </div>
      </div>
    </div>
  );
}

export default function Register() {
  return <I18nBoundary><RegisterContent /></I18nBoundary>;
}
