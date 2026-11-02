import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { I18nBoundary, useI18n } from '../context/I18nContext';
import LanguageSelector from '../components/LanguageSelector';

function LoginContent() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedNext = new URLSearchParams(location.search).get('next');
  const nextPath = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/discover';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const authenticatedUser = await login(email, password, role);
      const rolePath = authenticatedUser.role === 'ADMIN'
        ? '/admin'
        : authenticatedUser.role === 'PROVIDER'
          ? '/provider'
          : nextPath;
      navigate(rolePath);
    } catch (err) {
      setError(err.message || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <Link to="/" className="auth-back-link">← SmartServiceAI</Link>
          <LanguageSelector />
        </div>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
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
            <LogIn size={24} />
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{t('auth.welcome')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {t('auth.loginDescription')}
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.55rem',
            background: 'var(--danger-light)',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }} role="alert">
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label htmlFor="login-email" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
              {t('auth.email')}
            </label>
            <input
              id="login-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="login-role" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
              {t('auth.signInAs')}
            </label>
            <select
              id="login-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              <option value="USER">{t('auth.customer')}</option>
              <option value="PROVIDER">{t('auth.serviceProvider')}</option>
              <option value="ADMIN">{t('auth.administrator')}</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <label htmlFor="login-password" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('auth.password')}</label>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.enterPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                title={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                style={{ position: 'absolute', top: '50%', right: '0.7rem', transform: 'translateY(-50%)', display: 'grid', placeItems: 'center', width: '32px', height: '32px', color: 'var(--text-muted)' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
          >
            {loading ? t('auth.authenticating') : t('auth.signIn')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {t('auth.noAccount')} <Link to={`/register${location.search}`} style={{ fontWeight: 600 }}>{t('auth.createOne')}</Link>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return <I18nBoundary><LoginContent /></I18nBoundary>;
}
