import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import L from 'leaflet';
import { api } from '../api/client';
import {
  MapPin,
  Navigation,
  Sliders,
  Star,
  CheckCircle,
  Calendar,
  Clock,
  X,
  RefreshCw,
  AlertCircle,
  Compass,
  Search,
  ArrowRight
} from 'lucide-react';

// Fix standard Leaflet default marker icon paths in bundled environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom user location icon (Red Pin)
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom provider icon (Blue Pin)
const providerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function Maps() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const providerMarkersRef = useRef({});
  const nearbyProvidersRef = useRef([]);

  // Default initial location: Mumbai (or auto-detected)
  const [userLocation, setUserLocation] = useState({
    latitude: 19.0760,
    longitude: 72.8777,
    name: 'Mumbai, Maharashtra',
    isRealGps: false,
    accuracy: null,
  });

  const [locationSearchInput, setLocationSearchInput] = useState('');
  const [searchingLocation, setSearchingLocation] = useState(false);

  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(searchParams.get('service') || '');
  const [radiusKm, setRadiusKm] = useState(15);
  const [nearbyProviders, setNearbyProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [syncingDemo, setSyncingDemo] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');

  // In-page Booking Modal State
  const [bookingProvider, setBookingProvider] = useState(null);
  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [bookingTime, setBookingTime] = useState('10:00');
  const [serviceAddress, setServiceAddress] = useState('Sector 4, Central Area');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Synchronize nearbyProvidersRef so Leaflet HTML popups can trigger modal
  useEffect(() => {
    nearbyProvidersRef.current = nearbyProviders;
  }, [nearbyProviders]);

  // Expose global callback for Leaflet popup "Book Now" buttons
  useEffect(() => {
    window.triggerBookNow = (providerId) => {
      const p = nearbyProvidersRef.current.find(item => item.provider_id === providerId);
      if (p) {
        setBookingProvider(p);
        setBookingSuccess(false);
        setBookingError('');
        setServiceAddress(`Apartment 4B, ${userLocation.name.split(',')[0]}`);
      }
    };

    return () => {
      delete window.triggerBookNow;
    };
  }, [userLocation]);

  // Load available services for filter dropdown
  useEffect(() => {
    api.get('/services')
      .then(setServices)
      .catch(console.error);
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView(
        [userLocation.latitude, userLocation.longitude],
        12
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Fetch nearby providers whenever location, service, or radius changes
  useEffect(() => {
    fetchNearbyProviders(userLocation);
  }, [userLocation, selectedServiceId, radiusKm]);

  const fetchNearbyProviders = async (coords = userLocation) => {
    setLoading(true);
    try {
      const params = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius_km: radiusKm,
        auto_locate: true,
      };
      if (selectedServiceId) {
        params.service_id = selectedServiceId;
      }

      const providers = await api.get('/maps/nearby', params);
      setNearbyProviders(providers);
      updateMapMarkers(coords, providers);
    } catch (err) {
      console.error('Error fetching nearby providers:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateMapMarkers = (coords, providers) => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    providerMarkersRef.current = {};

    // 1. Add User marker (Red)
    const userMarker = L.marker([coords.latitude, coords.longitude], { icon: userIcon })
      .bindPopup(`
        <div style="font-family: inherit; font-size: 0.9rem; line-height: 1.4;">
          <b style="color: #ef4444;">📍 Selected Location</b><br/>
          <span>${coords.name}</span><br/>
          <span style="font-size: 0.8rem; color: #64748b;">GPS: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}</span><br/>
          <span style="font-size: 0.75rem; color: #2563eb;">Search Radius: ${radiusKm} km</span>
        </div>
      `);
    markersLayerRef.current.addLayer(userMarker);
    // Automatically open popup so user immediately sees the location opened on the map
    userMarker.openPopup();

    // 2. Add Search Radius Circle (Blue semi-transparent)
    const radiusCircle = L.circle([coords.latitude, coords.longitude], {
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
      weight: 1.5,
      radius: radiusKm * 1000
    });
    markersLayerRef.current.addLayer(radiusCircle);

    // 3. Add Provider Markers (Blue)
    const bounds = L.latLngBounds([[coords.latitude, coords.longitude]]);

    providers.forEach((p) => {
      if (p.latitude && p.longitude) {
        bounds.extend([p.latitude, p.longitude]);

        const popupContent = `
          <div style="font-family: inherit; min-width: 220px; padding: 4px;">
            <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 2px; color: #0f172a;">${p.provider_name}</div>
            <div style="color: #2563eb; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">${p.service}</div>
            <div style="display: flex; gap: 8px; font-size: 0.8rem; color: #475569; margin-bottom: 4px;">
              <span>⭐ ${p.rating}</span>
              <span>•</span>
              <span style="font-weight: 600; color: #0f172a;">📍 ${p.distance} km away</span>
            </div>
            <div style="font-size: 0.8rem; color: #059669; font-weight: 600; margin-bottom: 8px;">
              ${p.availability} • ₹${p.price}
            </div>
            <div style="display: flex; gap: 6px; margin-top: 8px;">
              <a href="/providers/${p.provider_id}" style="flex: 1; text-align: center; background: #f1f5f9; color: #0f172a; padding: 5px 8px; border-radius: 6px; font-size: 0.8rem; text-decoration: none; font-weight: 600; border: 1px solid #cbd5e1;">View Profile</a>
              <button onclick="window.triggerBookNow(${p.provider_id})" style="flex: 1; text-align: center; background: #2563eb; color: #fff; padding: 5px 8px; border-radius: 6px; font-size: 0.8rem; border: none; cursor: pointer; font-weight: 600;">Book Now</button>
            </div>
          </div>
        `;

        const marker = L.marker([p.latitude, p.longitude], { icon: providerIcon })
          .bindPopup(popupContent);
        markersLayerRef.current.addLayer(marker);
        providerMarkersRef.current[p.provider_id] = marker;
      }
    });

    // Fit map bounds safely
    if (providers.length > 0) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else {
      mapInstanceRef.current.setView([coords.latitude, coords.longitude], 12);
    }
  };

  // Location search input change with debounced suggestion fetch
  const handleInputChange = (val) => {
    setLocationSearchInput(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!val || val.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/maps/search-suggestions', { query: val.trim() });
        setSuggestions(res || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      }
    }, 200);
  };

  // User selects a suggestion from dropdown
  const handleSelectSuggestion = (sugg) => {
    setShowSuggestions(false);
    setLocationSearchInput(sugg.display_name.split(',')[0]);
    const newLocation = {
      latitude: sugg.latitude,
      longitude: sugg.longitude,
      name: sugg.display_name,
      isRealGps: false,
      accuracy: null
    };
    setUserLocation(newLocation);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([sugg.latitude, sugg.longitude], 13, { duration: 1.5 });
    }
    setSyncSuccessMsg(`Opened location: ${sugg.display_name.split(',').slice(0, 2).join(',')}`);
  };

  // Location Search Handler: Search any city or address worldwide
  const handleSearchLocation = async (e, customQuery = null) => {
    if (e) e.preventDefault();
    setShowSuggestions(false);
    const queryToSearch = customQuery || locationSearchInput;
    if (!queryToSearch || !queryToSearch.trim()) return;

    setSearchingLocation(true);
    setGeoError(null);
    setSyncSuccessMsg('');

    try {
      const results = await api.get('/maps/geocode', { query: queryToSearch.trim() });
      if (results && results.length > 0) {
        const top = results[0];
        const newLocation = {
          latitude: top.latitude,
          longitude: top.longitude,
          name: top.display_name,
          isRealGps: false,
          accuracy: null
        };
        setUserLocation(newLocation);
        setLocationSearchInput(top.display_name.split(',')[0]);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([top.latitude, top.longitude], 13, { duration: 1.5 });
        }
        setSyncSuccessMsg(`Opened location: ${top.display_name.split(',').slice(0, 2).join(',')}`);
      } else {
        setGeoError(`Location "${queryToSearch}" not found. Try searching another city or neighborhood.`);
      }
    } catch (err) {
      console.error('Error searching location:', err);
      setGeoError('Failed to geocode location. Please try again.');
    } finally {
      setSearchingLocation(false);
    }
  };

  // Browser Geolocation API Handler: "Use my current location"
  const handleUseCurrentLocation = () => {
    setGeoError(null);
    setSyncSuccessMsg('');

    if (!navigator.geolocation) {
      setGeoError('Geolocation API is not supported by your browser.');
      return;
    }

    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const newLocation = {
          latitude,
          longitude,
          name: 'My Current GPS Location',
          isRealGps: true,
          accuracy: Math.round(accuracy)
        };

        setUserLocation(newLocation);
        setLocationSearchInput('Current GPS Location');
        setGeoLocating(false);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 13, { duration: 1.5 });
        }
        setSyncSuccessMsg(`GPS Location locked: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      },
      (error) => {
        console.warn('Geolocation error:', error);
        let errorMsg = 'Could not retrieve your physical location.';
        if (error.code === 1) {
          errorMsg = 'Location permission was denied. Please allow location permissions in your browser or search a location above.';
        } else if (error.code === 2) {
          errorMsg = 'Location position is currently unavailable from your device.';
        } else if (error.code === 3) {
          errorMsg = 'Location request timed out. Please try again.';
        }
        setGeoError(errorMsg);
        setGeoLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  // Focus provider on map from list
  const handleFocusProvider = (p) => {
    if (!mapInstanceRef.current || !p.latitude || !p.longitude) return;
    mapInstanceRef.current.flyTo([p.latitude, p.longitude], 14, { duration: 1 });
    const marker = providerMarkersRef.current[p.provider_id];
    if (marker) {
      setTimeout(() => marker.openPopup(), 400);
    }
  };

  // Relocate demo providers around the user's real GPS coordinates if requested
  const handleSyncDemoProviders = async () => {
    setSyncingDemo(true);
    setSyncSuccessMsg('');
    try {
      const res = await api.post('/maps/sync-demo-providers', null, {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        area_name: userLocation.name,
      });
      setSyncSuccessMsg(`Placed verified providers around ${userLocation.name.split(',')[0]}!`);
      await fetchNearbyProviders(userLocation);
    } catch (err) {
      console.error('Error syncing demo providers:', err);
      alert('Could not sync demo providers: ' + err.message);
    } finally {
      setSyncingDemo(false);
    }
  };

  // Booking Submission Handler
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!bookingProvider) return;

    setBookingSubmitting(true);
    setBookingError('');
    try {
      await api.post('/bookings', {
        provider_id: bookingProvider.provider_id,
        service_id: bookingProvider.service_id || (services[0]?.id || 1),
        booking_date: bookingDate,
        booking_time: bookingTime,
        service_address: serviceAddress,
        special_instructions: specialInstructions,
      });

      setBookingSuccess(true);
      setTimeout(() => {
        setBookingProvider(null);
        navigate('/bookings');
      }, 1500);
    } catch (err) {
      setBookingError(err.message || 'Failed to submit appointment');
    } finally {
      setBookingSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
      {/* Title & Architecture Flow */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <div className="badge badge-primary" style={{ padding: '0.25rem 0.65rem' }}>
            <Compass size={13} />
            <span>GIS Haversine Spatial Engine</span>
          </div>
          {userLocation.isRealGps && (
            <div className="badge badge-accent" style={{ padding: '0.25rem 0.65rem' }}>
              <Navigation size={13} />
              <span>Real Browser GPS Active</span>
            </div>
          )}
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>Spatial Provider Discovery</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Search any city, area, or address worldwide, or use your physical GPS location to discover nearby verified service specialists on OpenStreetMap.
        </p>
      </div>

      {/* Geolocation feedback alerts */}
      {geoError && (
        <div style={{
          background: 'var(--danger-light)',
          color: 'var(--danger)',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem'
        }}>
          <AlertCircle size={16} />
          <span>{geoError}</span>
        </div>
      )}

      {syncSuccessMsg && (
        <div style={{
          background: 'var(--accent-light)',
          color: '#065f46',
          border: '1px solid #a7f3d0',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem'
        }}>
          <CheckCircle size={16} />
          <span>{syncSuccessMsg}</span>
        </div>
      )}

      {/* Control Bar: Location Search + Current GPS, Service Filter, Radius */}
      <div className="card" style={{
        padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1.25rem',
        alignItems: 'end'
      }}>
        {/* 1. Location Search Input + "Use my current location" Button */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
            Search Location / Use GPS
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <form onSubmit={handleSearchLocation} style={{ display: 'flex', gap: '0.35rem', flex: 1.5, position: 'relative' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} color="var(--primary)" style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search city, area, address..."
                  value={locationSearchInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  style={{ paddingLeft: '2.1rem', width: '100%', height: '38px', fontSize: '0.85rem' }}
                />

                {/* Instant suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#ffffff',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 9999,
                    marginTop: '4px',
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }}>
                    {suggestions.map((sugg, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSuggestion(sugg)}
                        style={{
                          padding: '0.6rem 0.85rem',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          color: 'var(--text-main)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                      >
                        <MapPin size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 500 }}>{sugg.display_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={searchingLocation}
                className="btn btn-secondary btn-sm"
                style={{ height: '38px', padding: '0 0.85rem', whiteSpace: 'nowrap' }}
              >
                {searchingLocation ? 'Searching...' : 'Search'}
              </button>
            </form>

            <button
              onClick={handleUseCurrentLocation}
              disabled={geoLocating}
              className="btn btn-primary btn-sm"
              style={{ height: '38px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title="Detect physical position via Browser Geolocation API"
            >
              <Navigation size={13} className={geoLocating ? 'spin' : ''} />
              <span>{geoLocating ? 'Locating...' : 'My Location'}</span>
            </button>
          </div>
        </div>

        {/* 2. Service Category Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
            Filter by Service
          </label>
          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            style={{ height: '38px' }}
          >
            <option value="">All Service Specializations</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.category_name})</option>
            ))}
          </select>
        </div>

        {/* 3. Haversine Radius Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
            <span>Search Radius (Haversine)</span>
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{radiusKm} km</span>
          </div>
          <input
            type="range"
            min="2"
            max="40"
            step="1"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            style={{ width: '100%', cursor: 'pointer', height: '38px' }}
          />
        </div>
      </div>

      {/* Popular City Quick-Search Chips */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.4rem',
        alignItems: 'center',
        marginBottom: '1rem',
        padding: '0 0.25rem'
      }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Search:</span>
        {['Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Bengaluru', 'Pune', 'Kolkata', 'Jaipur', 'Ahmedabad', 'London', 'New York'].map((c) => (
          <button
            key={c}
            onClick={() => {
              setLocationSearchInput(c);
              handleSearchLocation(null, c);
            }}
            style={{
              background: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              padding: '0.2rem 0.65rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            📍 {c}
          </button>
        ))}
      </div>

      {/* Current GPS Coordinates Badge */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.65rem 1rem',
        marginBottom: '1.25rem',
        fontSize: '0.85rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin size={16} color="#ef4444" />
          <span>
            Current Map Center: <strong style={{ color: 'var(--text-main)' }}>{userLocation.name.split(',').slice(0, 3).join(',')}</strong> (Lat: <code>{userLocation.latitude.toFixed(4)}</code>, Lon: <code>{userLocation.longitude.toFixed(4)}</code>
            {userLocation.accuracy ? ` • Accuracy: ±${userLocation.accuracy}m` : ''})
          </span>
        </div>

        {/* Sync helper button */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          <button
            onClick={handleSyncDemoProviders}
            disabled={syncingDemo}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            title="Place demo providers at your current GPS/searched location"
          >
            <RefreshCw size={12} className={syncingDemo ? 'spin' : ''} />
            <span>Place Providers Around Here</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Leaflet Map (Left) + Providers List (Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 1fr)',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {/* Leaflet Map Box */}
        <div>
          <div
            ref={mapContainerRef}
            style={{
              height: '580px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
              position: 'relative',
              zIndex: 1,
            }}
          />

          {/* Map Legend */}
          <div style={{
            marginTop: '0.75rem',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
            alignItems: 'center'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
              <strong>Red Marker:</strong> Selected Location / GPS Center
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' }}></span>
              <strong>Blue Marker:</strong> Verified Service Provider
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#93c5fd', border: '1px solid #2563eb', display: 'inline-block' }}></span>
              <strong>Blue Circle:</strong> {radiusKm} km Haversine Radius
            </span>
          </div>
        </div>

        {/* Nearby Provider Cards */}
        <div style={{ maxHeight: '620px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.25rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            background: 'var(--bg-main)',
            paddingBottom: '0.5rem',
            zIndex: 5,
            borderBottom: '1px solid var(--border)'
          }}>
            <h3 style={{ fontSize: '1.1rem' }}>
              Nearby Providers ({nearbyProviders.length})
            </h3>
            {loading && <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>Calculating...</span>}
          </div>

          {nearbyProviders.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
              <MapPin size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
              <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>No Providers in this Radius</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                No active service providers found within {radiusKm} km of {userLocation.name.split(',')[0]}.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  onClick={() => setRadiusKm(35)}
                  className="btn btn-secondary btn-sm"
                >
                  Expand Search Radius to 35 km
                </button>
                <button
                  onClick={handleSyncDemoProviders}
                  disabled={syncingDemo}
                  className="btn btn-primary btn-sm"
                >
                  Place Providers Around Here
                </button>
              </div>
            </div>
          ) : (
            nearbyProviders.map((p) => (
              <div
                key={p.provider_id}
                className="card"
                style={{
                  padding: '1.15rem',
                  border: '1px solid var(--border)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onClick={() => handleFocusProvider(p)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', marginBottom: '0.15rem' }}>{p.provider_name}</h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>{p.service}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: 'var(--secondary)' }}>₹{p.price}</div>
                    <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>{p.availability}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#b45309', fontWeight: 600 }}>
                    <Star size={13} fill="#f59e0b" color="#f59e0b" />
                    <span>{p.rating}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--text-main)', fontWeight: 600 }}>
                    <MapPin size={13} color="var(--primary)" />
                    <span>{p.distance} km away</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {p.address}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                  <Link
                    to={`/providers/${p.provider_id}`}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, textAlign: 'center' }}
                  >
                    View Profile
                  </Link>
                  <button
                    onClick={() => {
                      setBookingProvider(p);
                      setBookingSuccess(false);
                      setBookingError('');
                      setServiceAddress(`Apartment 4B, ${userLocation.name.split(',')[0]}`);
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                  >
                    Book Now
                  </button>
                </div>
              </div>
            ))
          )}
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
                  Booking verified professional matching your selected location
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
                  <h4 style={{ fontSize: '1rem' }}>{bookingProvider.provider_name}</h4>
                  <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>{bookingProvider.service}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>₹{bookingProvider.price}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 {bookingProvider.distance} km away</div>
                </div>
              </div>
            </div>

            {bookingSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <CheckCircle size={48} color="var(--accent)" style={{ margin: '0 auto 1rem' }} />
                <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>Appointment Confirmed!</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Your booking request has been sent to {bookingProvider.provider_name}. Redirecting to your bookings dashboard...
                </p>
              </div>
            ) : (
              <form onSubmit={handleConfirmBooking} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                    Doorstep Service Address
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
                    Special Instructions / Symptoms
                  </label>
                  <textarea
                    rows={2}
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="e.g. Bring spare compressor capacitor, gate code #1234"
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
