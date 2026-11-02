import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import {
  Sparkles,
  Search,
  CheckCircle2,
  Star,
  MapPin,
  ArrowRight,
  ShieldCheck,
  X,
  Navigation,
  Wrench,
  Lightbulb,
  AlertTriangle,
  Mic,
  Camera,
  ImagePlus,
  Trash2,
} from 'lucide-react';

export default function Discover() {
  const { t, language } = useI18n();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationSaved, setLocationSaved] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [apiError, setApiError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [resolvedLocation, setResolvedLocation] = useState('');
  const [detectingGps, setDetectingGps] = useState(false);
  const [categories, setCategories] = useState([]);
  const [problemAnalysis, setProblemAnalysis] = useState(null);
  const [showProvidersForSimple, setShowProvidersForSimple] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [problemImage, setProblemImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const imageInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const voiceRecognitionRef = useRef(null);
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

  useEffect(() => () => {
    if (problemImage?.previewUrl) URL.revokeObjectURL(problemImage.previewUrl);
  }, [problemImage?.previewUrl]);

  useEffect(() => () => {
    voiceRecognitionRef.current?.abort();
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    const video = cameraVideoRef.current;
    if (!cameraOpen || !video || !cameraStreamRef.current) return undefined;
    video.srcObject = cameraStreamRef.current;
    video.play().catch(() => setCameraError(t('discover.cameraFailed')));
    return () => {
      video.srcObject = null;
    };
  }, [cameraOpen, t]);

  useEffect(() => {
    let isMounted = true;
    api.get('/categories')
      .then((data) => { if (isMounted) setCategories(data); })
      .catch(console.error);

    const loadSavedLocation = async () => {
      try {
        const savedLocation = user
          ? await api.get('/users/me/location')
          : JSON.parse(localStorage.getItem('serviceLocation') || 'null');
        const localLocation = JSON.parse(localStorage.getItem('serviceLocation') || 'null');
        const storedLocation = savedLocation || localLocation;
        if (!isMounted || !storedLocation) return;

        const displayName = storedLocation.display_name || storedLocation.address_line || storedLocation.city;
        setLocation(displayName);
        setSelectedLocation({
          display_name: displayName,
          latitude: storedLocation.latitude,
          longitude: storedLocation.longitude,
          city: storedLocation.city,
          state: storedLocation.state,
        });
        setLocationSaved(Boolean(user ? savedLocation : localLocation));
      } catch (err) {
        console.error('Could not load saved service location:', err);
      }
    };

    loadSavedLocation();
    return () => { isMounted = false; };
  }, [user?.id]);

  useEffect(() => {
    if (location.length < 2 || selectedLocation?.display_name === location) {
      setLocationSuggestions([]);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        const suggestions = await api.get('/maps/search-suggestions', { query: location, limit: 5 });
        const uniqueSuggestions = new Map();
        (Array.isArray(suggestions) ? suggestions : []).forEach((suggestion) => {
          const key = `${suggestion.latitude}:${suggestion.longitude}`;
          if (!uniqueSuggestions.has(key)) uniqueSuggestions.set(key, suggestion);
        });
        setLocationSuggestions([...uniqueSuggestions.values()]);
      } catch {
        setLocationSuggestions([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [location, selectedLocation]);

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
  const handleProblemAnalysis = async (
    searchQuery,
    targetLocation = location,
    coords = null,
    forceShowProviders = false,
    imageId = null,
  ) => {
    if (!searchQuery || !searchQuery.trim()) return;

    setLoading(true);
    setShowProvidersForSimple(forceShowProviders);
    setCheckedSteps({});
    setRecommendations([]);
    setProblemAnalysis(null);
    setApiError('');

    try {
      const analysis = await api.post('/ai/analyze-problem', {
        query: searchQuery.trim(),
        location: targetLocation || undefined,
        image_id: imageId || undefined,
      });

      setProblemAnalysis(analysis);
      setImageError(imageId && !analysis.image_context_used ? t('discover.imageAnalysisUnavailable') : '');

      if (analysis.decision === 'PROFESSIONAL_SERVICE' && analysis.service_id && !analysis.message) {
        const reqPayload = {
          query: searchQuery,
          service_id: analysis.service_id,
          location: targetLocation || undefined,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          max_candidates: 6
        };

        const recRes = await api.post('/ai/recommend', reqPayload);
        setRecommendations(recRes.recommendations || []);
        setProblemAnalysis({
          ...analysis,
          provider_service_available: recRes.provider_service_available,
        });
        if (recRes.location) {
          setResolvedLocation(recRes.location);
        }
      } else {
        setRecommendations([]);
      }
    } catch (err) {
      console.error('Error analyzing problem in Discover:', err);
      setRecommendations([]);
      setApiError(err instanceof TypeError ? t('discover.requestFailed') : (err.message || t('discover.requestFailed')));
    } finally {
      setLoading(false);
    }
  };

  // User escalation: when simple problem guidance is not enough and user explicitly requests professional service
  const handleEscalateToProfessional = async () => {
    if (!problemAnalysis?.service_id) {
      setRecommendations([]);
      return;
    }

    setShowProvidersForSimple(true);
    setLoading(true);
    setApiError('');
    try {
      const targetQuery = query || problemAnalysis?.query || 'General Service';
      const svcId = problemAnalysis?.service_id;

      const reqPayload = {
        query: targetQuery,
        service_id: svcId,
        location: location || undefined,
        latitude: selectedLocation?.latitude,
        longitude: selectedLocation?.longitude,
        max_candidates: 6
      };
      const recRes = await api.post('/ai/recommend', reqPayload);
      setRecommendations(recRes.recommendations || []);
      setProblemAnalysis((current) => current ? {
        ...current,
        provider_service_available: recRes.provider_service_available,
      } : current);
      if (recRes.location) {
        setResolvedLocation(recRes.location);
      }
    } catch (err) {
      console.error('Error escalating to professional providers:', err);
      setApiError(err instanceof TypeError ? t('discover.requestFailed') : (err.message || t('discover.requestFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchError('');
    setApiError('');
    setLocationError('');

    if (!query.trim()) {
      setSearchError(t('discover.queryRequired'));
      return;
    }

    if (!selectedLocation) {
      setLocationError(t('discover.locationRequired'));
      return;
    }

    const saveLocationAndSearch = async () => {
      try {
        if (!locationSaved) {
          const savedPayload = {
            title: 'Home',
            address_line: selectedLocation.display_name,
            city: selectedLocation.city || selectedLocation.display_name.split(',')[0],
            state: selectedLocation.state || null,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            is_primary: true,
          };

          if (user) await api.put('/users/me/location', savedPayload);
          else localStorage.setItem('serviceLocation', JSON.stringify({ ...savedPayload, display_name: selectedLocation.display_name }));
          setLocationSaved(true);
        }

        let imageId = problemImage?.imageId || null;
        if (problemImage && !imageId) {
          setUploadingImage(true);
          setImageError('');
          try {
            const form = new FormData();
            form.append('upload', problemImage.file);
            const uploaded = await api.post('/ai/problem-images', form);
            imageId = uploaded.image_id;
            setProblemImage((current) => (
              current?.file === problemImage.file ? { ...current, imageId } : current
            ));
          } catch (uploadError) {
            setImageError(uploadError.message || t('discover.imageUploadFailed'));
            return;
          } finally {
            setUploadingImage(false);
          }
        }

        handleProblemAnalysis(query, selectedLocation.display_name, {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
        }, false, imageId);
      } catch (err) {
        setLocationError(err.message || t('discover.saveLocationFailed'));
      }
    };

    saveLocationAndSearch();
  };

  const attachProblemImage = (file) => {
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setImageError(t('discover.imageTypeError'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError(t('discover.imageSizeError'));
      return;
    }
    setImageError('');
    setProblemImage({
      file,
      imageId: null,
      previewUrl: URL.createObjectURL(file),
    });
  };

  const handleProblemImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    attachProblemImage(file);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('discover.cameraUnsupported'));
      return;
    }
    setCameraError('');
    try {
      cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      setCameraOpen(true);
    } catch (error) {
      console.error('Discover camera could not be opened:', error);
      setCameraError(t('discover.cameraPermissionDenied'));
    }
  };

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
  };

  const captureCameraImage = () => {
    const video = cameraVideoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraError(t('discover.cameraFailed'));
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError(t('discover.cameraFailed'));
        return;
      }
      attachProblemImage(new File([blob], `problem-photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      closeCamera();
    }, 'image/jpeg', 0.9);
  };

  const toggleVoiceInput = () => {
    if (voiceListening) {
      voiceRecognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError(t('discover.voiceUnsupported'));
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' }[language] || 'en-IN';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .map((result) => result[0]?.transcript || '')
          .join(' ')
          .trim();
        if (transcript) {
          setQuery((current) => `${current.trim()}${current.trim() ? ' ' : ''}${transcript}`);
          setSearchError('');
          setApiError('');
        }
      };
      recognition.onerror = (event) => {
        if (event.error !== 'aborted') setVoiceError(t('discover.voiceFailed'));
      };
      recognition.onend = () => {
        setVoiceListening(false);
        voiceRecognitionRef.current = null;
      };
      setVoiceError('');
      voiceRecognitionRef.current = recognition;
      recognition.start();
      setVoiceListening(true);
    } catch {
      setVoiceListening(false);
      voiceRecognitionRef.current = null;
      setVoiceError(t('discover.voiceFailed'));
    }
  };

  const handleDetectGpsForDiscover = () => {
    if (!navigator.geolocation) {
      setLocationError(t('discover.gpsUnsupported'));
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const gpsLocation = {
          display_name: `Current location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          latitude,
          longitude,
          city: 'Current location',
        };
        setSelectedLocation(gpsLocation);
        setLocation(gpsLocation.display_name);
        setLocationSaved(false);
        setLocationError('');
        setDetectingGps(false);
      },
      (err) => {
        console.warn('GPS error:', err);
        setDetectingGps(false);
        setLocationError(t('discover.gpsFailed'));
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const selectSuggestedLocation = (suggestion) => {
    setSelectedLocation(suggestion);
    setLocation(suggestion.display_name);
    setLocationSuggestions([]);
    setLocationSaved(false);
    setLocationError('');
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
    setServiceAddress(selectedLocation?.display_name || location || resolvedLocation || '');
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
        special_instructions: specialInstructions,
        problem_image_id: problemImage?.imageId || undefined,
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
    <div className="discover-page">
      {/* Hero Section */}
      <section className="discover-hero">
        <div className="discover-hero-inner">
          <div className="discover-hero-copy">
            <div className="discover-eyebrow">
              <span className="discover-eyebrow-icon"><Sparkles size={15} /></span>
              <span>{t('discover.badge')}</span>
            </div>
            <h1>{t('discover.title')}</h1>
            <p className="discover-hero-description">{t('discover.description')}</p>

            <form onSubmit={handleSearch} className="discover-search-form">
              <label className="discover-field-label" htmlFor="problem-search">{t('discover.problem')}</label>
              <div className="discover-problem-input">
                <Search size={20} aria-hidden="true" />
                <input
                  id="problem-search"
                  type="search"
                  placeholder={t('discover.problemPlaceholder')}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSearchError('');
                    setApiError('');
                    setProblemAnalysis(null);
                    setRecommendations([]);
                    setResolvedLocation('');
                  }}
                  autoComplete="off"
                  required
                />
                {query && (
                  <button type="button" className="discover-clear-button" onClick={() => setQuery('')} aria-label={t('discover.clearProblem')}>
                    <X size={17} />
                  </button>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={handleProblemImage}
                aria-label={t('discover.addImage')}
              />
              <div className="discover-input-tools">
                <button
                  type="button"
                  className="discover-tool-button"
                  onClick={openCamera}
                  disabled={uploadingImage || loading || cameraOpen}
                >
                  <Camera size={16} />
                  <span>{t('discover.takePhoto')}</span>
                </button>
                <button
                  type="button"
                  className="discover-tool-button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage || loading}
                >
                  <ImagePlus size={16} />
                  <span>{problemImage ? t('discover.replaceImage') : t('discover.addImage')}</span>
                </button>
                <button
                  type="button"
                  className={`discover-tool-button ${voiceListening ? 'is-listening' : ''}`}
                  onClick={toggleVoiceInput}
                  aria-pressed={voiceListening}
                >
                  <Mic size={16} />
                  <span>{voiceListening ? t('discover.stopVoice') : t('discover.startVoice')}</span>
                </button>
              </div>
              {cameraOpen && (
                <div className="discover-camera-panel">
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    playsInline
                    muted
                    aria-label={t('discover.cameraPreview')}
                  />
                  <div className="discover-camera-actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={captureCameraImage}>
                      {t('discover.capturePhoto')}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={closeCamera}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}
              {problemImage && (
                <div className="discover-image-preview">
                  <img src={problemImage.previewUrl} alt={problemImage.file.name} />
                  <div>
                    <strong>{problemImage.file.name}</strong>
                    <span>{problemImage.imageId ? t('discover.imageAttached') : t('discover.imageSelected')}</span>
                  </div>
                  <button
                    type="button"
                    className="discover-remove-image"
                    onClick={() => {
                      setProblemImage(null);
                      setImageError('');
                      if (imageInputRef.current) imageInputRef.current.value = '';
                    }}
                    aria-label={t('discover.removeImage')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
              {uploadingImage && <div className="discover-input-message" role="status">{t('common.loading')}</div>}
              {imageError && <div className="discover-input-message is-error" role="status">{imageError}</div>}
              {voiceError && <div className="discover-input-message is-error" role="status">{voiceError}</div>}
              {cameraError && <div className="discover-input-message is-error" role="alert">{cameraError}</div>}

              <div className="discover-example-prompts" aria-label={t('discover.tryExamples')}>
                <span>{t('discover.tryExamples')}</span>
                {['exampleFan', 'exampleTap', 'exampleFridge'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setQuery(t(`discover.${key}`));
                      setSearchError('');
                      setApiError('');
                      setProblemAnalysis(null);
                      setRecommendations([]);
                    }}
                  >
                    {t(`discover.${key}`)}
                  </button>
                ))}
              </div>

              <div className="discover-location-row">
                <div className="discover-location-field">
                  <label className="discover-field-label" htmlFor="service-location">{t('discover.location')}</label>
                  <div className="discover-location-input">
                    <MapPin size={19} aria-hidden="true" />
                    <input
                      id="service-location"
                      type="text"
                      placeholder={t('discover.locationPlaceholder')}
                      value={location}
                      onChange={(event) => {
                        setLocation(event.target.value);
                        setSelectedLocation(null);
                        setLocationSaved(false);
                        setLocationError('');
                        setApiError('');
                        setProblemAnalysis(null);
                        setRecommendations([]);
                        setResolvedLocation('');
                      }}
                      autoComplete="address-level2"
                      aria-autocomplete="list"
                      aria-controls="location-suggestions"
                    />
                    <button
                      type="button"
                      className="discover-gps-button"
                      onClick={handleDetectGpsForDiscover}
                      disabled={detectingGps}
                      title={t('discover.useLocation')}
                      aria-label={t('discover.useLocation')}
                    >
                      <Navigation size={17} className={detectingGps ? 'spin' : ''} />
                    </button>
                    {locationSuggestions.length > 0 && (
                      <div id="location-suggestions" className="discover-location-suggestions" role="listbox">
                        {locationSuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.latitude}-${suggestion.longitude}`}
                            type="button"
                            role="option"
                            aria-selected={selectedLocation?.display_name === suggestion.display_name}
                            onClick={() => selectSuggestedLocation(suggestion)}
                          >
                            <MapPin size={16} />
                            <span>{suggestion.display_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={`discover-location-status ${locationError ? 'error' : ''}`} aria-live="polite">
                    {locationError || (selectedLocation
                      ? `${locationSaved ? t('discover.savedLocation') : t('discover.selectedLocation')} · ${selectedLocation.display_name}`
                      : t('discover.locationHint'))}
                  </div>
                </div>

                <button type="submit" disabled={loading || detectingGps} className="btn btn-primary discover-submit-button">
                  <Search size={17} />
                  <span>{loading ? t('discover.finding') : t('discover.findHelp')}</span>
                  <ArrowRight size={17} />
                </button>
              </div>
              {searchError && <div className="discover-form-error" role="alert">{searchError}</div>}
            </form>
            {categories.length > 0 && (
              <nav className="discover-category-links" aria-label={t('discover.categories')}>
                <span>{t('discover.categories')}:</span>
                {categories.slice(0, 5).map((category) => (
                  <Link key={category.id} to={`/services/${category.slug}`}>
                    {category.name}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="discover-hero-visual" aria-hidden="true">
            <div className="discover-orbit discover-orbit-one" />
            <div className="discover-orbit discover-orbit-two" />
            <div className="discover-visual-grid">
              <span className="discover-visual-icon discover-icon-tool"><Wrench size={24} /></span>
              <span className="discover-visual-icon discover-icon-pin"><MapPin size={25} /></span>
              <span className="discover-visual-icon discover-icon-check"><ShieldCheck size={23} /></span>
              <span className="discover-visual-center"><Sparkles size={31} /></span>
            </div>
            <div className="discover-visual-caption">
              <span className="discover-caption-dot" />
              <span>{t('discover.visualCaption')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="container discover-content">
        {/* Loading Indicator */}
        {loading && (
          <section className="discover-results" aria-live="polite" aria-busy="true">
            <div className="discover-results-heading">
              <div>
                <span className="discover-section-kicker">{t('discover.badge')}</span>
                <h2>{t('discover.evaluating')}</h2>
              </div>
              <span className="discover-loading-label">{t('discover.finding')}</span>
            </div>
            <div className="discover-provider-grid">
              {[0, 1, 2].map((item) => (
                <div className="discover-provider-skeleton" key={item}>
                  <span className="skeleton skeleton-title" />
                  <span className="skeleton skeleton-line" />
                  <span className="skeleton skeleton-line short" />
                  <span className="skeleton skeleton-actions" />
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && apiError && (
          <div className="discover-error-card" role="alert">
            <div className="discover-state-icon error"><AlertTriangle size={22} /></div>
            <div>
              <h3>{t('discover.requestFailedTitle')}</h3>
              <p>{apiError}</p>
            </div>
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
                  <span>{t('discover.simpleProblem')}</span>
                </div>
                <span style={{ fontSize: '0.85rem', color: '#047857', fontWeight: 600 }}>
                  {problemAnalysis.category} • {problemAnalysis.service}
                    {problemAnalysis.matched_subservice ? ` · ${problemAnalysis.matched_subservice}` : ''}
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#065f46', background: '#d1fae5', padding: '0.25rem 0.6rem', borderRadius: '4px', fontWeight: 600 }}>
                {t('discover.noCost')}
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
                  {t('discover.checklist')}
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
                  {problemAnalysis.follow_up_prompt || t('discover.followUpDefault')}
                </span>
              </div>
              <button
                onClick={handleEscalateToProfessional}
                disabled={loading}
                className="btn btn-primary btn-sm"
                style={{ background: '#059669', borderColor: '#059669', color: '#ffffff', fontWeight: 700 }}
              >
                {showProvidersForSimple ? t('discover.showTechnicians') : t('discover.findSpecialists', { service: problemAnalysis.service })}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* BRANCH 2: PROFESSIONAL SERVICE REQUIRED CARD             */}
        {/* ======================================================== */}
        {!loading && problemAnalysis && problemAnalysis.decision === 'NO_MATCH' && (
          <div className="card" style={{
            background: 'linear-gradient(135deg, #fff7ed 0%, #fff 100%)',
            border: '1px solid #fed7aa',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: 'var(--shadow-md)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <AlertTriangle size={20} color="#c2410c" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9a4d11', textTransform: 'uppercase' }}>{t('discover.noMatch')}</span>
            </div>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: '#7c2d12' }}>{t('discover.noCategory')}</h3>
            <p style={{ fontSize: '1rem', color: '#7c2d12', marginBottom: 0 }}>
              {problemAnalysis.message || t('discover.noCategoryDescription')}
            </p>
          </div>
        )}

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
                  <span>{t('discover.professionalRequired')}</span>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                  {t('discover.category')}: {problemAnalysis.category} → {problemAnalysis.service}
                  {problemAnalysis.matched_subservice ? ` · ${problemAnalysis.matched_subservice}` : ''}
                </span>
              </div>
              <span className="badge badge-warning" style={{ fontSize: '0.8rem' }}>
                {t('discover.urgency')}: {problemAnalysis.urgency || 'MODERATE'}
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
                  {t('discover.safety')}
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
                  {t('discover.pipeline', { location: resolvedLocation || location || t('discover.selectedLocation') })}
                </span>
              </div>
              <Link to={`/maps?service=${problemAnalysis.service_id}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>
                {t('discover.viewNearby')}
              </Link>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* RECOMMENDED PROVIDERS SECTION                            */}
        {/* ======================================================== */}
        {/* Render providers if professional service, or if user escalated from simple guidance */}
        {(problemAnalysis?.decision === 'PROFESSIONAL_SERVICE' || showProvidersForSimple) && !apiError && (
          <section className="discover-results">
            <div className="discover-results-heading">
              <div>
                <span className="discover-section-kicker">{t('discover.badge')}</span>
                <h2>
                  {t('discover.recommended', { service: problemAnalysis?.service || t('common.services') })}
                </h2>
                <p>
                  {resolvedLocation || location || t('discover.selectedLocation')}
                </p>
              </div>
            </div>

            {recommendations.length === 0 ? (
              <div className="discover-empty-state">
                <div className="discover-state-icon"><MapPin size={22} /></div>
                <h3>{t('discover.emptyTitle')}</h3>
                <p>
                  {problemAnalysis?.decision === 'NO_MATCH'
                    ? (problemAnalysis?.message || t('discover.noSuitable'))
                    : problemAnalysis?.provider_service_available === false
                      ? t('discover.noProvidersForService', { service: problemAnalysis?.service || t('common.services') })
                      : (problemAnalysis?.location_error || t('discover.noVerified'))}
                </p>
                {problemAnalysis?.provider_service_available === false && (
                  <Link to="/services" className="btn btn-secondary btn-sm">
                    {t('discover.browseServices')}
                  </Link>
                )}
              </div>
            ) : (
              <div className="discover-provider-grid">
                {recommendations.map((p) => {
                  return (
                    <article key={p.provider_id} className="discover-provider-card">
                      {/* Card Header */}
                      <div className="discover-provider-heading">
                        <div>
                          <div className="discover-provider-name-row">
                            <h3>{p.business_name || p.name}</h3>
                            {p.is_verified && (
                              <ShieldCheck size={18} aria-label={t('discover.verified')} title={t('discover.verified')} />
                            )}
                          </div>
                          <p className="discover-provider-subtitle">{p.name}</p>
                        </div>

                        <div className="discover-match-score">
                          <strong>{p.match_score}%</strong>
                          <span>{t('discover.match')}</span>
                        </div>
                      </div>

                      <div className="discover-provider-service">
                        <Wrench size={15} />
                        <span>{p.service || problemAnalysis?.service || t('common.services')}</span>
                      </div>

                      <div className="discover-provider-facts">
                        <div className="discover-provider-fact">
                          <Star size={16} fill={p.total_ratings > 0 ? 'currentColor' : 'none'} />
                          <span>
                            {p.total_ratings > 0 && p.rating_avg != null
                              ? `${Number(p.rating_avg).toFixed(1)} (${t('booking.reviews', { count: p.total_ratings })})`
                              : t('booking.newProvider')}
                          </span>
                        </div>
                        <div className="discover-provider-fact">
                          <MapPin size={16} />
                          <span>{p.address || t('discover.locationUnavailable')}</span>
                        </div>
                        {p.distance_km != null && (
                          <div className="discover-provider-fact">
                            <Navigation size={15} />
                            <span>{p.distance_km} {t('discover.distanceAway')}</span>
                          </div>
                        )}
                        {p.experience_years != null && (
                          <div className="discover-provider-fact">
                            <ShieldCheck size={15} />
                            <span>{t('discover.experience', { count: p.experience_years })}</span>
                          </div>
                        )}
                        <div className={`discover-availability ${p.is_available ? 'available' : 'unavailable'}`}>
                          <span />
                          {p.is_available ? t('discover.available') : t('discover.unavailable')}
                        </div>
                      </div>

                      {p.price != null && (
                        <div className="discover-provider-price">
                          <span>{t('discover.servicePrice')}</span>
                          <strong>₹{Number(p.price).toLocaleString()}</strong>
                        </div>
                      )}

                      {p.bio && <p className="discover-provider-bio">{p.bio}</p>}

                      {/* Action Buttons */}
                      <div className="discover-provider-actions">
                        <Link
                          to={`/providers/${p.provider_id}`}
                          className="btn btn-secondary"
                        >
                          {t('discover.viewProfile')}
                        </Link>
                        <button
                          onClick={() => openBookModal(p)}
                          className="btn btn-primary"
                        >
                          {t('discover.bookNow')}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
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
              {t('discover.selfRecommended')}
            </h4>
            <p style={{ color: '#047857', fontSize: '0.9rem', maxWidth: '620px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
              {t('discover.selfDescription')}
            </p>
            <button
              onClick={handleEscalateToProfessional}
              className="btn btn-primary"
              style={{ background: '#059669', borderColor: '#059669' }}
            >
              {t('discover.issuePersists', { service: problemAnalysis.service, location: location || t('discover.useLocation') })}
            </button>
          </div>
        )}

        {/* Category Explorer Section */}
        <section className="discover-categories">
          <h2>{t('discover.categories')}</h2>
          <p>
            {t('discover.categoriesDescription')}
          </p>

          <div className="discover-category-grid">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/services?category=${cat.id}`}
                className="discover-category-card"
              >
                <div className="discover-category-icon">
                  {cat.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3>{cat.name}</h3>
                  <span>
                    {t('discover.specializations', { count: cat.services?.length || 0 })}
                  </span>
                </div>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        </section>
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
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{t('discover.schedule')}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {t('discover.bookCertified', { service: problemAnalysis?.service || t('common.services') })}
                </p>
              </div>
              <button
                onClick={() => setBookingProvider(null)}
                aria-label={t('common.close')}
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
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>
                    {bookingProvider.price != null ? `₹${Number(bookingProvider.price).toLocaleString()}` : t('booking.priceOnRequest')}
                  </div>
                  {bookingProvider.distance_km != null && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <MapPin size={12} aria-hidden="true" /> {bookingProvider.distance_km} {t('discover.distanceAway')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {bookingSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <CheckCircle2 size={48} color="var(--accent)" style={{ margin: '0 auto 1rem' }} />
                <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>{t('discover.success')}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {t('booking.savedDescription')}
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
                    <label htmlFor="discover-booking-date" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      {t('discover.date')}
                    </label>
                    <input
                      id="discover-booking-date"
                      type="date"
                      value={bookingDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setBookingDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="discover-booking-time" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      {t('discover.time')}
                    </label>
                    <select
                      id="discover-booking-time"
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
                  <label htmlFor="discover-booking-address" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    {t('discover.address')}
                  </label>
                  <input
                    id="discover-booking-address"
                    type="text"
                    value={serviceAddress}
                    onChange={(e) => setServiceAddress(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="discover-booking-instructions" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    {t('discover.instructions')}
                  </label>
                  <textarea
                    id="discover-booking-instructions"
                    rows={2}
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder={t('discover.detailsPlaceholder')}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setBookingProvider(null)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={bookingSubmitting}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    {bookingSubmitting ? t('maps.confirming') : t('discover.confirm')}
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
