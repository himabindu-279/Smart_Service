import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, User, Briefcase, Shield } from 'lucide-react';

export default function Register() {
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
  const [address, setAddress] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedNext = new URLSearchParams(location.search).get('next');
  const nextPath = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/discover';
  const adminNextPath = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/dashboard?tab=analytics';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (role === 'ADMIN') {
      try {
        const authenticatedUser = await login(email, password);
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
      payload.address = address;
      payload.latitude = 12.9116;
      payload.longitude = 77.6389;
    }

    try {
      await register(payload);
      navigate(nextPath);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '3.5rem 1.5rem 6rem', maxWidth: '540px' }}>
      <div className="card" style={{ padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{role === 'ADMIN' ? 'Administrator Sign In' : 'Create Your Account'}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {role === 'ADMIN' ? 'Sign in with your authorized administrator account.' : 'Join the smart AI service network as a customer or certified specialist.'}
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
            <span>Customer</span>
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
            <span>Service Specialist</span>
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
            <span>Admin</span>
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
              Full Name
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
                Email
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {role !== 'ADMIN' && <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+91-9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="At least 6 characters"
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
                Provider Professional Profile
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                  Business or Trade Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. QuickFix Electrical Services"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                    Years Exp.
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
                    Qualifications / Certifications
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Certified HVAC Technician"
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                  Operating Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sector 2, HSR Layout, Bengaluru"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                  Short Professional Bio
                </label>
                <textarea
                  rows={2}
                  placeholder="Briefly describe your services and experience..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
          >
            {loading ? (role === 'ADMIN' ? 'Signing in...' : 'Creating account...') : role === 'ADMIN' ? 'Sign In as Admin' : `Register as ${role === 'PROVIDER' ? 'Provider' : 'Customer'}`}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {role === 'ADMIN' ? <>Not an administrator? <Link to="/login" style={{ fontWeight: 600 }}>Go to login</Link></> : <>Already have an account? <Link to="/login" style={{ fontWeight: 600 }}>Sign In</Link></>}
        </div>
      </div>
    </div>
  );
}
