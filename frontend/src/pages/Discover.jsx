import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  Search,
  CheckCircle2,
  Star,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  Tag,
  X,
  Calendar,
  Navigation,
  Wrench,
  Lightbulb,
  AlertTriangle,
  HelpCircle,
  CheckSquare,
  Square
} from 'lucide-react';

export default function Discover() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [resolvedLocation, setResolvedLocation] = useState('');
  const [detectingGps, setDetectingGps] = useState(false);
  const [categories, setCategories] = useState([]);
  const [problemAnalysis, setProblemAnalysis] = useState(null);
  const [showProvidersForSimple, setShowProvidersForSimple] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // In-page Booking Modal State
  const [bookingProvider, setBookingProvider] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [bookingTime, setBookingTime] = useState('10:00');
  const [serviceAddress, setServiceAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Sample problems matching the exact user specification
  const samplePrompts = [
    "My AC remote is not working",
    "My AC is running but not cooling",
    "My bathroom pipe is leaking",
    "I have severe tooth pain",
    "My laptop is very slow",
    "My tap is leaking"
  ];

  useEffect(() => {
    // Load categories
    api.get('/categories')
      .then(setCategories)
      .catch(console.error);

    // Initial default analysis for Discover entry point without hardcoded city
    handleProblemAnalysis('My AC is running but not cooling', '');
  }, []);

  /**
   * Main Discover Flow:
   * User enters problem
   *        ↓
   * LLM analyzes the request
   *        ↓
   * Classify intent/problem
   *        ↓
   * Determine whether simple guidance is appropriate
   *        ↓
   * ┌─────────────────────────┐
   * │                         │
   * Simple problem          Professional service
   * │                         │
   * ↓                         ↓
   * LLM guidance              Identify service
   *                                   ↓
   *                          Get user location
   *                                   ↓
   *                          Find nearby providers
   *                                   ↓
   *                          Availability filtering
   *                                   ↓
   *                          AI recommendation
   *                                   ↓
   *                          Provider ranking
   *                                   ↓
   *                          Show providers
   */
  const handleProblemAnalysis = async (searchQuery, targetLocation = location, coords = null, forceShowProviders = false) => {
    if (!searchQuery || !searchQuery.trim()) return;

    setLoading(true);
    setShowProvidersForSimple(forceShowProviders);
    setCheckedSteps({});

    try {
      // 1. LLM analyzes request & classifies intent into Simple Guidance vs Professional Service
      const analysis = await api.post('/ai/analyze-problem', {
        query: searchQuery.trim(),
        location: targetLocation || undefined,
      });

      setProblemAnalysis(analysis);

      // 2. Branch according to decision
      if (analysis.decision === 'PROFESSIONAL_SERVICE' || forceShowProviders) {
        // Professional service flow:
        // Identify service -> Get user location -> Find nearby providers -> Availability filtering -> AI recommendation -> Provider ranking -> Show providers
        const reqPayload = {
          query: searchQuery,
          service_id: analysis.service_id,
          location: targetLocation || undefined,
          max_candidates: 6
        };
        if (coords?.latitude && coords?.longitude) {
          reqPayload.latitude = coords.latitude;
          reqPayload.longitude = coords.longitude;
        }

        const recRes = await api.post('/ai/recommend', reqPayload);
        setRecommendations(recRes.recommendations || []);
        if (recRes.location) {
          setResolvedLocation(recRes.location);
        }
      } else {
        // Simple problem flow:
        // LLM provides useful guidance first. Do NOT immediately show providers for every small problem.
        setRecommendations([]);
      }
    } catch (err) {
      console.error('Error analyzing problem in Discover:', err);
    } finally {
      setLoading(false);
    }
  };

  // User escalation: when simple problem guidance is not enough and user explicitly requests professional service
  const handleEscalateToProfessional = async () => {
    setShowProvidersForSimple(true);
    setLoading(true);
    try {
      const targetQuery = query || problemAnalysis?.query || 'General Service';
      const svcId = problemAnalysis?.service_id || 1;

      const reqPayload = {
        query: targetQuery,
        service_id: svcId,
        location: location || undefined,
        max_candidates: 6
      };
      const recRes = await api.post('/ai/recommend', reqPayload);
      setRecommendations(recRes.recommendations || []);
      if (recRes.location) {
        setResolvedLocation(recRes.location);
      }
    } catch (err) {
      console.error('Error escalating to professional providers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      handleProblemAnalysis(query, location);
    }
  };

  const handleDetectGpsForDiscover = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const gpsLabel = `Current Location (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
        setLocation(gpsLabel);
        setDetectingGps(false);
        handleProblemAnalysis(query || 'AC Repair', 'Current GPS Location', { latitude, longitude });
      },
      (err) => {
        console.warn('GPS error:', err);
        setDetectingGps(false);
        alert('Could not detect location. Please type your city name manually.');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const openBookModal = (provider) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setBookingProvider(provider);
    setBookingSuccess(false);
    setBookingError('');
    if (problemAnalysis?.service_id) {
      setSelectedServiceId(problemAnalysis.service_id);
    }
    const locPart = location || resolvedLocation || 'Local Area';
    setServiceAddress(`Apartment 4B, Sector 2, ${locPart}`);
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!bookingProvider) return;
    setBookingSubmitting(true);
    setBookingError('');

    try {
      const svcId = selectedServiceId || problemAnalysis?.service_id || 1;
      await api.post('/bookings', {
        provider_id: bookingProvider.provider_id,
        service_id: Number(svcId),
        booking_date: bookingDate,
        booking_time: bookingTime,
        service_address: serviceAddress,
        special_instructions: specialInstructions
      });
      setBookingSuccess(true);
      setTimeout(() => {
        setBookingProvider(null);
        navigate('/bookings');
      }, 1500);
    } catch (err) {
      setBookingError(err.message || 'Failed to submit booking');
    } finally {
      setBookingSubmitting(false);
    }
  };

  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Hero Section */}
      <section style={{
        background: 'radial-gradient(ellipse at top, #eff6ff 0%, #f8fafc 70%)',
        padding: '3rem 0 2.5rem',
        borderBottom: '1px solid var(--border)'
      }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: '850px' }}>
          <div className="badge badge-primary" style={{ marginBottom: '1rem', padding: '0.35rem 0.85rem' }}>
            <Sparkles size={14} />
            <span>AI Diagnostic Problem Triage</span>
          </div>

          <h1 style={{ fontSize: '2.4rem', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
            Describe Any Service Problem
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginBottom: '1.75rem' }}>
            Type any issue naturally. Our AI analyzes your request, provides step-by-step DIY guidance for simple problems, and connects you to verified specialists when professional service is required.
          </p>

          {/* Search Box: Service Problem Input + Location Beside It */}
          <form onSubmit={handleSearch} style={{
            display: 'flex',
            alignItems: 'center',
            background: '#ffffff',
            borderRadius: 'var(--radius-full)',
            padding: '0.35rem 0.5rem 0.35rem 1.25rem',
            boxShadow: 'var(--shadow-lg)',
            border: '2px solid var(--primary-glow)',
            marginBottom: '0.85rem',
            gap: '0.5rem',
            flexWrap: 'wrap'
          }}>
            {/* 1. Problem Description Input */}
            <div style={{ display: 'flex', alignItems: 'center', flex: '1.6', minWidth: '240px' }}>
              <Search size={20} color="var(--primary)" style={{ flexShrink: 0, marginRight: '0.6rem' }} />
              <input
                type="text"
                placeholder="Describe your issue (e.g. My AC remote is not working, pipe leaking...)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  border: 'none',
                  boxShadow: 'none',
                  padding: '0.6rem 0',
                  fontSize: '0.95rem',
                  width: '100%'
                }}
              />
            </div>

            {/* Vertical Divider */}
            <div style={{ width: '1px', height: '28px', background: 'var(--border)' }} />

            {/* 2. Target Location (Requirement 4) */}
            <div style={{ display: 'flex', alignItems: 'center', flex: '1.2', minWidth: '220px' }}>
              <MapPin size={18} color="#ef4444" style={{ flexShrink: 0, marginRight: '0.5rem' }} />
              <input
                type="text"
                placeholder="Enter your location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{
                  border: 'none',
                  boxShadow: 'none',
                  padding: '0.6rem 0',
                  fontSize: '0.95rem',
                  width: '100%'
                }}
              />
              <button
                type="button"
                onClick={handleDetectGpsForDiscover}
                disabled={detectingGps}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: 'var(--radius-full)',
                  cursor: 'pointer',
                  padding: '0.35rem 0.65rem',
                  color: 'var(--primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  flexShrink: 0
                }}
                title="Detect current location using browser geolocation"
              >
                <Navigation size={13} className={detectingGps ? 'spin' : ''} />
                <span>{detectingGps ? 'Detecting...' : 'Use Current Location'}</span>
              </button>
            </div>

            {/* 3. Action Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ borderRadius: 'var(--radius-full)', padding: '0.7rem 1.6rem', flexShrink: 0 }}
            >
              {loading ? 'Analyzing Problem...' : 'Diagnose Problem'}
            </button>
          </form>

          {/* User Prompt Test Case Examples */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Try Examples:</span>
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(p);
                  handleProblemAnalysis(p, location);
                }}
                style={{
                  background: query === p ? 'var(--primary-light)' : '#ffffff',
                  border: `1px solid ${query === p ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-full)',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.75rem',
                  color: query === p ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: query === p ? 600 : 400,
                  transition: 'all 0.15s ease'
                }}
              >
                "{p}"
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="container" style={{ marginTop: '2.5rem' }}>
        {/* Loading Indicator */}
        {loading && (
          <div className="card" style={{ textAlign: 'center', padding: '2.5rem', marginBottom: '2rem' }}>
            <Sparkles size={32} className="animate-spin" style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
            <h4 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>LLM Diagnostic Evaluation in Progress</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Analyzing symptoms, classifying problem complexity, and determining whether DIY guidance or certified professional dispatch is required...
            </p>
          </div>
        )}

        {/* ======================================================== */}
        {/* BRANCH 1: SIMPLE PROBLEM — LLM DIY GUIDANCE CARD         */}
        {/* ======================================================== */}
        {!loading && problemAnalysis && problemAnalysis.decision === 'SIMPLE_GUIDANCE' && (
          <div className="card" style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            border: '1px solid #a7f3d0',
            padding: '1.75rem',
            marginBottom: '2rem',
            boxShadow: 'var(--shadow-md)'
          }}>
            {/* Header Badge Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  background: '#10b981',
                  color: '#ffffff',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  <CheckCircle2 size={15} />
                  <span>Simple Problem — Self-Troubleshooting Recommended</span>
                </div>
                <span style={{ fontSize: '0.85rem', color: '#047857', fontWeight: 600 }}>
                  {problemAnalysis.category} • {problemAnalysis.service}
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#065f46', background: '#d1fae5', padding: '0.25rem 0.6rem', borderRadius: '4px', fontWeight: 600 }}>
                Zero Cost • No Immediate Booking Needed
              </span>
            </div>

            {/* Problem Title */}
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.75rem', color: '#064e3b' }}>
              {problemAnalysis.problem_title}
            </h3>

            {/* Detailed LLM Guidance */}
            <p style={{ fontSize: '1rem', lineHeight: '1.65', color: '#14532d', marginBottom: '1.25rem', whiteSpace: 'pre-line' }}>
              {problemAnalysis.guidance}
            </p>

            {/* Interactive Step-by-Step DIY Checklist */}
            {problemAnalysis.diy_steps && problemAnalysis.diy_steps.length > 0 && (
              <div style={{
                background: '#ffffff',
                border: '1px solid #bbf7d0',
                borderRadius: 'var(--radius-md)',
                padding: '1.1rem 1.25rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46', marginBottom: '0.65rem', textTransform: 'uppercase' }}>
                  Step-by-Step Troubleshooting Checklist:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {problemAnalysis.diy_steps.map((step, idx) => {
                    const isChecked = !!checkedSteps[idx];
                    return (
                      <label
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.6rem',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          color: isChecked ? '#94a3b8' : '#1e293b',
                          textDecoration: isChecked ? 'line-through' : 'none'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => setCheckedSteps({ ...checkedSteps, [idx]: e.target.checked })}
                          style={{ marginTop: '0.25rem', cursor: 'pointer' }}
                        />
                        <span>{step}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Follow-up / Escalation Banner */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#dcfce7',
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #86efac',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontSize: '0.9rem', fontWeight: 600 }}>
                <Lightbulb size={18} color="#16a34a" />
                <span>
                  {problemAnalysis.follow_up_prompt || `Tried these steps and still experiencing problems?`}
                </span>
              </div>
              <button
                onClick={handleEscalateToProfessional}
                disabled={loading}
                className="btn btn-primary btn-sm"
                style={{ background: '#059669', borderColor: '#059669', color: '#ffffff', fontWeight: 700 }}
              >
                {showProvidersForSimple ? 'Showing Verified Technicians Below' : `Find ${problemAnalysis.service} Specialists Nearby`}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* BRANCH 2: PROFESSIONAL SERVICE REQUIRED CARD             */}
        {/* ======================================================== */}
        {!loading && problemAnalysis && problemAnalysis.decision === 'PROFESSIONAL_SERVICE' && (
          <div className="card" style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
            border: '1px solid #bfdbfe',
            padding: '1.75rem',
            marginBottom: '2rem',
            boxShadow: 'var(--shadow-md)'
          }}>
            {/* Header Badge Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  background: 'var(--primary)',
                  color: '#ffffff',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  <Wrench size={15} />
                  <span>Professional Service Required</span>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                  Category: {problemAnalysis.category} → {problemAnalysis.service}
                </span>
              </div>
              <span className="badge badge-warning" style={{ fontSize: '0.8rem' }}>
                Urgency: {problemAnalysis.urgency || 'MODERATE'}
              </span>
            </div>

            {/* Problem Title */}
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.75rem', color: 'var(--secondary)' }}>
              {problemAnalysis.problem_title}
            </h3>

            {/* Detailed LLM Diagnostic Guidance */}
            <p style={{ fontSize: '1rem', lineHeight: '1.65', color: '#334155', marginBottom: '1.25rem', whiteSpace: 'pre-line' }}>
              {problemAnalysis.guidance}
            </p>

            {/* Diagnostic safety tips if available */}
            {problemAnalysis.diy_steps && problemAnalysis.diy_steps.length > 0 && (
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1.15rem',
                marginBottom: '1rem'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Safety & Preliminary Measures Before Technician Arrival:
                </div>
                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#475569' }}>
                  {problemAnalysis.diy_steps.map((step, idx) => (
                    <li key={idx} style={{ marginBottom: '0.25rem' }}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pipeline Status Confirmation */}
            <div style={{
              background: '#ffffff',
              padding: '0.85rem 1.15rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--primary)" />
                <span>
                  Marketplace pipeline activated: Matched certified <strong>{problemAnalysis.service}</strong> specialists near <strong>{resolvedLocation || location || 'your location'}</strong>
                </span>
              </div>
              <Link to={`/maps?service=${problemAnalysis.service_id}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>
                View Nearby on Maps
              </Link>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* RECOMMENDED PROVIDERS SECTION                            */}
        {/* ======================================================== */}
        {/* Render providers if professional service, or if user escalated from simple guidance */}
        {(problemAnalysis?.decision === 'PROFESSIONAL_SERVICE' || showProvidersForSimple || (!problemAnalysis && recommendations.length > 0)) && (
          <div style={{ marginBottom: '3.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
                  Recommended {problemAnalysis?.service || 'Service'} Providers {resolvedLocation ? `in ${resolvedLocation.split(',')[0]}` : (location ? `in ${location.split(',')[0]}` : '')}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Personalized AI matching for <strong>{resolvedLocation || location || 'your chosen location'}</strong>: ranked by suitability, rating, distance, and verified reviews.
                </p>
              </div>
            </div>

            {recommendations.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'var(--text-muted)' }}>
                  {problemAnalysis?.location_error || 'No verified specialists for this service were found within 50 km of your selected location.'}
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: '1.75rem'
              }}>
                {recommendations.map((p) => {
                  const minPrice = p.price || 500;
                  const maxPrice = minPrice + 450;

                  return (
                    <div key={p.provider_id} className="card" style={{
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative'
                    }}>
                      {/* Card Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                            <h3 style={{ fontSize: '1.15rem' }}>{p.business_name}</h3>
                            {p.is_verified && (
                              <ShieldCheck size={18} color="var(--primary)" title="Verified Specialist" />
                            )}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {p.name} • {p.experience_years} years experience
                          </div>
                        </div>

                        {/* Match Score Badge */}
                        <div style={{
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#ffffff',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.35rem 0.65rem',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{p.match_score}%</div>
                          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>Match</div>
                        </div>
                      </div>

                      {/* Stats Strip */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.55rem 0.85rem',
                        background: 'var(--bg-main)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '1rem',
                        fontSize: '0.85rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#b45309', fontWeight: 700 }}>
                          <Star size={15} fill="#f59e0b" color="#f59e0b" />
                          <span>{p.rating_avg}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                          <MapPin size={14} color="var(--primary)" />
                          <span>{p.distance_km} km • {p.address}</span>
                        </div>

                        <div style={{ color: '#059669', fontWeight: 600, fontSize: '0.8rem' }}>
                          Available Today
                        </div>

                        <div style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--secondary)' }}>
                          ₹{minPrice}–₹{maxPrice}
                        </div>
                      </div>

                      {/* Bio */}
                      <p style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        marginBottom: '1rem',
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {p.bio}
                      </p>

                      {/* Explainable Match Reasons */}
                      <div style={{
                        borderTop: '1px dashed var(--border)',
                        paddingTop: '0.85rem',
                        marginBottom: '1.25rem'
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                          AI Match Justification:
                        </div>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {p.reasons?.map((reason, rIdx) => (
                            <li key={rIdx} style={{ fontSize: '0.8rem', color: '#334155', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                              <CheckCircle2 size={13} color="var(--accent)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem' }}>
                        <Link
                          to={`/providers/${p.provider_id}`}
                          className="btn btn-secondary"
                          style={{ flex: 1, textAlign: 'center' }}
                        >
                          View Profile
                        </Link>
                        <button
                          onClick={() => openBookModal(p)}
                          className="btn btn-primary"
                          style={{ flex: 1.2 }}
                        >
                          Book Now
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* If Simple Problem and providers are hidden initially */}
        {!loading && problemAnalysis?.decision === 'SIMPLE_GUIDANCE' && !showProvidersForSimple && (
          <div className="card" style={{
            textAlign: 'center',
            padding: '2.5rem 1.5rem',
            marginBottom: '3.5rem',
            border: '1px dashed #a7f3d0',
            background: '#f0fdf4'
          }}>
            <Lightbulb size={36} color="#10b981" style={{ margin: '0 auto 0.75rem' }} />
            <h4 style={{ fontSize: '1.15rem', color: '#064e3b', marginBottom: '0.35rem' }}>
              Self-Troubleshooting Is Recommended First
            </h4>
            <p style={{ color: '#047857', fontSize: '0.9rem', maxWidth: '620px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
              Most issues of this type can be resolved at home at zero cost using the steps above.
              We avoid dispatching technicians for minor problems you can easily check yourself!
              If you have tried the checklist and still need on-site inspection, you can view verified specialists below.
            </p>
            <button
              onClick={handleEscalateToProfessional}
              className="btn btn-primary"
              style={{ background: '#059669', borderColor: '#059669' }}
            >
              Issue Persists? Show Verified {problemAnalysis.service} Specialists in {location || 'Nearby'}
            </button>
          </div>
        )}

        {/* Category Explorer Section */}
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Service Categories</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Explore verified professionals across all marketplace domains
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem'
          }}>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/services?category=${cat.id}`}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1.25rem',
                  transition: 'all 0.2s ease',
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700
                }}>
                  {cat.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '0.15rem' }}>{cat.name}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {cat.services?.length || 0} Specializations
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* In-Page Booking Modal */}
      {bookingProvider && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Schedule Appointment</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Booking certified specialist for {problemAnalysis?.service || 'Service'}
                </p>
              </div>
              <button
                onClick={() => setBookingProvider(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Provider Mini Summary */}
            <div style={{
              background: 'var(--primary-light)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--primary-glow)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '1rem' }}>{bookingProvider.business_name}</h4>
                  <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>{problemAnalysis?.service || 'Specialist'}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>₹{bookingProvider.price}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 {bookingProvider.distance_km} km away</div>
                </div>
              </div>
            </div>

            {bookingSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <CheckCircle2 size={48} color="var(--accent)" style={{ margin: '0 auto 1rem' }} />
                <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>Appointment Confirmed!</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Your booking request has been confirmed. Redirecting to your bookings dashboard...
                </p>
              </div>
            ) : (
              <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {bookingError && (
                  <div style={{
                    background: 'var(--danger-light)',
                    color: 'var(--danger)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem'
                  }}>
                    {bookingError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      Date
                    </label>
                    <input
                      type="date"
                      value={bookingDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setBookingDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Doorstep Address
                  </label>
                  <input
                    type="text"
                    value={serviceAddress}
                    onChange={(e) => setServiceAddress(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Instructions / Symptoms
                  </label>
                  <textarea
                    rows={2}
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="e.g. Unit makes clicking sound, 2nd floor flat"
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setBookingProvider(null)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bookingSubmitting}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    {bookingSubmitting ? 'Confirming...' : 'Confirm Appointment'}
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
