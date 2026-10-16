import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import L from 'leaflet';
import { api } from '../api/client';
import {
  MapPin,
  Navigation,
  Star,
  CheckCircle,
  Calendar,
  Clock,
  X,
  RefreshCw,
  AlertCircle,
  Compass,
  Search,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Check
} from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Leaflet default icon fix for bundled environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Leaflet Pins
const leafletUserIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const leafletProviderIcon = new L.Icon({
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

  // Container refs
  const mapContainerRef = useRef(null);
  
  // Active map engine: 'google' or 'leaflet'
  const [mapEngine, setMapEngine] = useState('google');
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [googleMapsError, setGoogleMapsError] = useState(null);
  const [loadingGoogleSdk, setLoadingGoogleSdk] = useState(false);

  // References for Google Map objects
  const googleMapInstanceRef = useRef(null);
  const googleMarkersRef = useRef([]);
  const googleUserMarkerRef = useRef(null);
  const googleCircleRef = useRef(null);
  const googleInfoWindowsRef = useRef({});
  const googleActiveInfoWindowRef = useRef(null);

  // References for Leaflet Map objects
  const leafletMapInstanceRef = useRef(null);
  const leafletMarkersLayerRef = useRef(null);
  const leafletProviderMarkersRef = useRef({});

  // Location state - starts EMPTY per requirement 4
  const [userLocation, setUserLocation] = useState(null);
  const [locationSearchInput, setLocationSearchInput] = useState('');
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);
  const [geoError, setGeoError] = useState(null);

  // Filter state
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(searchParams.get('service') || '');
  const [radiusKm, setRadiusKm] = useState(15);
  const [nearbyProviders, setNearbyProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  // In-page Booking Modal state
  const [bookingProvider, setBookingProvider] = useState(null);
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

  // Synchronize providers ref for window trigger callbacks
  const nearbyProvidersRef = useRef([]);
  useEffect(() => {
    nearbyProvidersRef.current = nearbyProviders;
  }, [nearbyProviders]);

  // Global window booking trigger used in HTML popups (both Google and Leaflet)
  useEffect(() => {
    window.triggerMarketplaceBooking = (providerId) => {
      const p = nearbyProvidersRef.current.find(item => item.provider_id === providerId);
      if (p) {
        setBookingProvider(p);
        setBookingSuccess(false);
        setBookingError('');
        setServiceAddress(userLocation ? userLocation.name : '');
      }
    };

    return () => {
      delete window.triggerMarketplaceBooking;
    };
  }, [userLocation]);

  // Load available approved services for dropdown
  useEffect(() => {
    api.get('/services', { only_active_providers: true })
      .then(setServices)
      .catch(err => console.error('Failed to load services for maps filter:', err));
  }, []);

  // 1. Attempt loading Google Maps JavaScript API with timeout
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      console.log('No Google Maps key found in frontend .env; using Leaflet OpenStreetMap engine.');
      setMapEngine('leaflet');
      return;
    }

    if (window.google && window.google.maps) {
      setGoogleMapsLoaded(true);
      setMapEngine('google');
      return;
    }

    setLoadingGoogleSdk(true);
    let timeoutId;

    // Google Maps Auth Failure hook
    window.gm_authFailure = () => {
      console.warn('Google Maps authentication failure. Falling back to Leaflet/OpenStreetMap.');
      setGoogleMapsError('Google Maps API key restriction or authorization notice. Switched to OpenStreetMap for guaranteed map visibility.');
      setMapEngine('leaflet');
    };

    const existingScript = document.getElementById('google-maps-js-sdk');
    if (existingScript) existingScript.remove();

    const script = document.createElement('script');
    script.id = 'google-maps-js-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      clearTimeout(timeoutId);
      setLoadingGoogleSdk(false);
      if (window.google && window.google.maps) {
        setGoogleMapsLoaded(true);
        setMapEngine('google');
      } else {
        setGoogleMapsError('Google Maps loaded but maps object unavailable.');
        setMapEngine('leaflet');
      }
    };

    script.onerror = () => {
      clearTimeout(timeoutId);
      setLoadingGoogleSdk(false);
      console.warn('Google Maps script network error. Falling back to Leaflet/OpenStreetMap.');
      setGoogleMapsError('Google Maps network connection error. Switched to OpenStreetMap for guaranteed map display.');
      setMapEngine('leaflet');
    };

    // 6-second timeout fallback: if Google Maps hangs or is blocked, switch to Leaflet so user NEVER sees a blank screen!
    timeoutId = setTimeout(() => {
      if (!window.google || !window.google.maps) {
        setLoadingGoogleSdk(false);
        console.warn('Google Maps connection timed out. Falling back to OpenStreetMap.');
        setGoogleMapsError('Google Maps took too long to connect. Switched to OpenStreetMap for instant map display.');
        setMapEngine('leaflet');
      }
    }, 6000);

    document.head.appendChild(script);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  // 2. Fetch Nearby Approved Providers from Backend using Haversine
  const fetchNearbyProviders = useCallback(async (coords) => {
    if (!coords) return;
    setLoadingProviders(true);
    try {
      const params = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius_km: radiusKm,
      };
      if (selectedServiceId) {
        params.service_id = selectedServiceId;
      }

      const data = await api.get('/maps/nearby', params);
      setNearbyProviders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching nearby providers:', err);
      setNearbyProviders([]);
    } finally {
      setLoadingProviders(false);
    }
  }, [radiusKm, selectedServiceId]);

  // Refetch when location, service filter, or radius changes
  useEffect(() => {
    if (userLocation) {
      fetchNearbyProviders(userLocation);
    }
  }, [userLocation, fetchNearbyProviders]);

  // 3. Render Leaflet Map Engine
  const renderLeafletMap = useCallback(() => {
    if (!mapContainerRef.current) return;

    // Clean up Google Map if present in DOM
    if (googleMapInstanceRef.current) {
      googleMapInstanceRef.current = null;
    }

    const defaultCenter = userLocation
      ? [userLocation.latitude, userLocation.longitude]
      : [20.5937, 78.9629]; // India national center for clean overview if no location set yet
    const defaultZoom = userLocation ? 13 : 5;

    if (!leafletMapInstanceRef.current) {
      mapContainerRef.current.innerHTML = '';
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      leafletMarkersLayerRef.current = L.layerGroup().addTo(map);
      leafletMapInstanceRef.current = map;
    } else {
      leafletMapInstanceRef.current.setView(defaultCenter, defaultZoom);
    }

    const map = leafletMapInstanceRef.current;
    const layer = leafletMarkersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    leafletProviderMarkersRef.current = {};

    // If user location is set, draw user pin and radius circle
    if (userLocation) {
      const userMarker = L.marker([userLocation.latitude, userLocation.longitude], { icon: leafletUserIcon })
        .bindPopup(`
          <div style="font-family: inherit; font-size: 0.85rem; padding: 4px; line-height: 1.4;">
            <b style="color: #ef4444;">📍 Your Location</b><br/>
            <span>${userLocation.name}</span><br/>
            <span style="font-size: 0.75rem; color: #64748b;">GPS: ${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}</span><br/>
            <span style="font-size: 0.75rem; color: #2563eb; font-weight: 600;">Radius: ${radiusKm} km</span>
          </div>
        `);
      layer.addLayer(userMarker);

      const circle = L.circle([userLocation.latitude, userLocation.longitude], {
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.08,
        weight: 1.5,
        radius: radiusKm * 1000
      });
      layer.addLayer(circle);

      // Draw provider markers
      const bounds = L.latLngBounds([[userLocation.latitude, userLocation.longitude]]);

      nearbyProviders.forEach((p) => {
        if (p.latitude && p.longitude) {
          bounds.extend([p.latitude, p.longitude]);

          const popupContent = `
            <div style="font-family: inherit; min-width: 220px; padding: 4px;">
              <div style="font-weight: 700; font-size: 1rem; color: #0f172a; margin-bottom: 2px;">${p.provider_name}</div>
              <div style="color: #2563eb; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">${p.service}</div>
              <div style="display: flex; gap: 8px; font-size: 0.8rem; color: #475569; margin-bottom: 6px;">
                <span>⭐ ${p.rating}</span>
                <span>•</span>
                <span style="font-weight: 600; color: #0f172a;">📍 ${p.distance} km away</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; margin-bottom: 8px;">
                <span style="color: #059669; font-weight: 600; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">${p.availability}</span>
                <span style="font-weight: 700; color: #0f172a;">₹${p.price}</span>
              </div>
              <div style="display: flex; gap: 6px; margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 6px;">
                <a href="/providers/${p.provider_id}" style="flex: 1; text-align: center; background: #f8fafc; color: #0f172a; padding: 6px 8px; border-radius: 6px; font-size: 0.78rem; text-decoration: none; font-weight: 600; border: 1px solid #cbd5e1;">View Profile</a>
                <button onclick="window.triggerMarketplaceBooking(${p.provider_id})" style="flex: 1; text-align: center; background: #2563eb; color: #ffffff; padding: 6px 8px; border-radius: 6px; font-size: 0.78rem; border: none; cursor: pointer; font-weight: 600;">Book Now</button>
              </div>
            </div>
          `;

          const marker = L.marker([p.latitude, p.longitude], { icon: leafletProviderIcon })
            .bindPopup(popupContent);
          layer.addLayer(marker);
          leafletProviderMarkersRef.current[p.provider_id] = marker;
        }
      });

      if (nearbyProviders.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }

    // Trigger Leaflet resize calculation to guarantee full visible rendering
    setTimeout(() => {
      if (leafletMapInstanceRef.current) {
        leafletMapInstanceRef.current.invalidateSize();
      }
    }, 150);
  }, [userLocation, radiusKm, nearbyProviders]);

  // 4. Render Google Map Engine
  const renderGoogleMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google || !window.google.maps) return;

    // Clean up Leaflet Map if present in DOM
    if (leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.remove();
      leafletMapInstanceRef.current = null;
    }

    const google = window.google;
    const defaultCenter = userLocation
      ? { lat: userLocation.latitude, lng: userLocation.longitude }
      : { lat: 20.5937, lng: 78.9629 };
    const defaultZoom = userLocation ? 13 : 5;

    if (!googleMapInstanceRef.current) {
      mapContainerRef.current.innerHTML = '';
      const map = new google.maps.Map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      });
      googleMapInstanceRef.current = map;
    } else {
      googleMapInstanceRef.current.setCenter(defaultCenter);
      googleMapInstanceRef.current.setZoom(defaultZoom);
    }

    const map = googleMapInstanceRef.current;

    // Clear previous markers
    if (googleUserMarkerRef.current) googleUserMarkerRef.current.setMap(null);
    if (googleCircleRef.current) googleCircleRef.current.setMap(null);
    googleMarkersRef.current.forEach(m => m.setMap(null));
    googleMarkersRef.current = [];
    googleInfoWindowsRef.current = {};

    if (userLocation) {
      const center = { lat: userLocation.latitude, lng: userLocation.longitude };

      // User Marker
      googleUserMarkerRef.current = new google.maps.Marker({
        position: center,
        map,
        title: 'Selected Location: ' + userLocation.name,
        zIndex: 999,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2.5
        }
      });

      // Radius Circle
      googleCircleRef.current = new google.maps.Circle({
        strokeColor: '#2563eb',
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: '#3b82f6',
        fillOpacity: 0.08,
        map,
        center,
        radius: radiusKm * 1000
      });

      // Provider Markers
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(center);

      nearbyProviders.forEach((p) => {
        if (p.latitude && p.longitude) {
          const markerPos = { lat: p.latitude, lng: p.longitude };
          bounds.extend(markerPos);

          const marker = new google.maps.Marker({
            position: markerPos,
            map,
            title: p.provider_name,
            icon: {
              url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
            }
          });

          const infoWindowContent = `
            <div style="font-family: inherit; min-width: 220px; padding: 4px;">
              <div style="font-weight: 700; font-size: 1rem; color: #0f172a; margin-bottom: 2px;">${p.provider_name}</div>
              <div style="color: #2563eb; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">${p.service}</div>
              <div style="display: flex; gap: 8px; font-size: 0.8rem; color: #475569; margin-bottom: 6px;">
                <span>⭐ ${p.rating}</span>
                <span>•</span>
                <span style="font-weight: 600; color: #0f172a;">📍 ${p.distance} km away</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; margin-bottom: 8px;">
                <span style="color: #059669; font-weight: 600; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">${p.availability}</span>
                <span style="font-weight: 700; color: #0f172a;">₹${p.price}</span>
              </div>
              <div style="display: flex; gap: 6px; margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 6px;">
                <a href="/providers/${p.provider_id}" style="flex: 1; text-align: center; background: #f8fafc; color: #0f172a; padding: 6px 8px; border-radius: 6px; font-size: 0.78rem; text-decoration: none; font-weight: 600; border: 1px solid #cbd5e1;">View Profile</a>
                <button onclick="window.triggerMarketplaceBooking(${p.provider_id})" style="flex: 1; text-align: center; background: #2563eb; color: #ffffff; padding: 6px 8px; border-radius: 6px; font-size: 0.78rem; border: none; cursor: pointer; font-weight: 600;">Book Now</button>
              </div>
            </div>
          `;

          const infoWindow = new google.maps.InfoWindow({ content: infoWindowContent });

          marker.addListener('click', () => {
            if (googleActiveInfoWindowRef.current) googleActiveInfoWindowRef.current.close();
            infoWindow.open(map, marker);
            googleActiveInfoWindowRef.current = infoWindow;
          });

          googleMarkersRef.current.push(marker);
          googleInfoWindowsRef.current[p.provider_id] = { marker, infoWindow };
        }
      });

      if (nearbyProviders.length > 0) {
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      }
    }

    // Trigger Google Maps resize event to guarantee full visibility
    setTimeout(() => {
      if (googleMapInstanceRef.current) {
        google.maps.event.trigger(googleMapInstanceRef.current, 'resize');
      }
    }, 150);
  }, [userLocation, radiusKm, nearbyProviders]);

  // Master Map Render Controller
  useEffect(() => {
    if (mapEngine === 'google' && googleMapsLoaded) {
      renderGoogleMap();
    } else {
      renderLeafletMap();
    }
  }, [mapEngine, googleMapsLoaded, renderGoogleMap, renderLeafletMap]);

  // 5. Browser Geolocation (HTML5 GPS - No key needed)
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setGeoLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let placeName = `My Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

        // Reverse geocode if available
        if (window.google && window.google.maps && window.google.maps.Geocoder) {
          try {
            const geocoder = new window.google.maps.Geocoder();
            const res = await geocoder.geocode({ location: { lat: latitude, lng: longitude } });
            if (res.results && res.results[0]) {
              placeName = res.results[0].formatted_address;
            }
          } catch (e) {
            console.log('Reverse geocode note:', e);
          }
        }

        const loc = { latitude, longitude, name: placeName };
        setUserLocation(loc);
        setLocationSearchInput(placeName);
        setGeoLocating(false);
      },
      (err) => {
        setGeoLocating(false);
        let msg = 'Unable to retrieve location. Please check browser permissions or enter manually.';
        if (err.code === 1) msg = 'Location permission denied. Please allow location access or type manually.';
        else if (err.code === 2) msg = 'Location unavailable. Please enter a city or address manually.';
        else if (err.code === 3) msg = 'Location request timed out. Please try again or type manually.';
        setGeoError(msg);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // 6. Manual Location Search
  const handleSearchLocation = async (e) => {
    if (e) e.preventDefault();
    const query = locationSearchInput.trim();
    if (!query) return;

    setSearchingLocation(true);
    setGeoError(null);

    try {
      let lat = null;
      let lng = null;
      let formattedName = query;

      // Primary: Google Geocoder if ready
      if (window.google && window.google.maps && window.google.maps.Geocoder) {
        try {
          const geocoder = new window.google.maps.Geocoder();
          const response = await geocoder.geocode({ address: query });
          if (response.results && response.results.length > 0) {
            const loc = response.results[0].geometry.location;
            lat = loc.lat();
            lng = loc.lng();
            formattedName = response.results[0].formatted_address;
          }
        } catch (gErr) {
          console.warn('Google Geocoder note:', gErr);
        }
      }

      // Fallback: Backend geocoding API
      if (lat === null || lng === null) {
        const results = await api.get('/maps/geocode', { query });
        if (results && results.length > 0) {
          lat = results[0].latitude;
          lng = results[0].longitude;
          formattedName = results[0].display_name;
        }
      }

      if (lat !== null && lng !== null) {
        const loc = { latitude: lat, longitude: lng, name: formattedName };
        setUserLocation(loc);
        setLocationSearchInput(formattedName);
      } else {
        setGeoError(`Could not find coordinates for "${query}". Please check the spelling or try another location.`);
      }
    } catch (err) {
      console.error('Location search error:', err);
      setGeoError('Failed to search location. Please check your connection and try again.');
    } finally {
      setSearchingLocation(false);
    }
  };

  // Card click pan handler
  const handleSelectProviderCard = (provider) => {
    if (mapEngine === 'google' && googleMapInstanceRef.current) {
      const entry = googleInfoWindowsRef.current[provider.provider_id];
      if (entry) {
        googleMapInstanceRef.current.panTo(entry.marker.getPosition());
        googleMapInstanceRef.current.setZoom(14);
        if (googleActiveInfoWindowRef.current) googleActiveInfoWindowRef.current.close();
        entry.infoWindow.open(googleMapInstanceRef.current, entry.marker);
        googleActiveInfoWindowRef.current = entry.infoWindow;
      }
    } else if (leafletMapInstanceRef.current) {
      const marker = leafletProviderMarkersRef.current[provider.provider_id];
      if (marker) {
        leafletMapInstanceRef.current.setView([provider.latitude, provider.longitude], 14);
        marker.openPopup();
      }
    }
  };

  // Booking submit handler
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!bookingProvider) return;

    setBookingSubmitting(true);
    setBookingError('');

    try {
      const payload = {
        provider_id: bookingProvider.provider_id,
        provider_service_id: bookingProvider.provider_service_id || undefined,
        service_id: bookingProvider.service_id,
        booking_date: `${bookingDate}T${bookingTime}:00`,
        address: serviceAddress || (userLocation ? userLocation.name : 'Client Address'),
        special_instructions: specialInstructions,
        notes: specialInstructions,
        estimated_price: bookingProvider.price,
      };

      await api.post('/bookings', payload);
      setBookingSuccess(true);
    } catch (err) {
      console.error('Booking failed:', err);
      setBookingError(err.message || 'Failed to complete booking. Please try again.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  return (
    <div className="maps-page-container">
      {/* Top Controls Header */}
      <div className="maps-header-bar">
        <div className="maps-header-title">
          <div className="icon-wrapper">
            <Compass className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Interactive Service Map</h1>
            <p className="text-xs text-slate-500">Live PostgreSQL-backed providers via Real Interactive Maps</p>
          </div>
        </div>

        {/* Location Search Form (Requirements 4 & 5: Initially Empty) */}
        <form onSubmit={handleSearchLocation} className="location-search-form">
          <div className="search-input-wrapper">
            <MapPin className="search-input-icon text-slate-400" />
            <input
              type="text"
              className="location-input"
              placeholder="Enter city, area, address, or postal code..."
              value={locationSearchInput}
              onChange={(e) => setLocationSearchInput(e.target.value)}
            />
            {locationSearchInput && (
              <button
                type="button"
                onClick={() => setLocationSearchInput('')}
                className="clear-input-btn"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={searchingLocation || !locationSearchInput.trim()}
            className="search-btn"
          >
            {searchingLocation ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>Search</span>
          </button>

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={geoLocating}
            className="gps-btn"
            title="Use browser Geolocation (HTML5 GPS - No Key Needed)"
          >
            {geoLocating ? (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            ) : (
              <Navigation className="w-4 h-4 text-blue-600" />
            )}
            <span>Use My Location</span>
          </button>
        </form>
      </div>

      {/* Geolocation Notice Banner */}
      {geoError && (
        <div className="maps-alert-banner warning">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-800">{geoError}</span>
          <button onClick={() => setGeoError(null)} className="ml-auto text-amber-600 hover:text-amber-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Google Maps Notice Banner (with easy switch/retry) */}
      {googleMapsError && (
        <div className="maps-alert-banner info">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <div className="flex-1 text-xs text-blue-900">
            <span className="font-semibold">Map Notice: </span>
            {googleMapsError}
          </div>
          <button
            onClick={() => {
              setMapEngine('google');
              setGoogleMapsError(null);
            }}
            className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs font-semibold"
          >
            Retry Google Maps
          </button>
        </div>
      )}

      {/* Main Grid: Sidebar + Canvas */}
      <div className="maps-main-grid">
        {/* Left Sidebar: Filters & Provider Cards */}
        <div className="maps-sidebar-panel">
          <div className="filter-controls-box">
            <div className="filter-row">
              <label className="filter-label">Filter Service</label>
              <select
                className="filter-select"
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
              >
                <option value="">All Approved Services</option>
                {services.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-row">
              <div className="flex justify-between items-center mb-1">
                <label className="filter-label">Search Radius</label>
                <span className="text-xs font-bold text-blue-600">{radiusKm} km</span>
              </div>
              <input
                type="range"
                min="3"
                max="50"
                step="1"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="radius-range-slider"
              />
            </div>

            {userLocation && (
              <div className="location-active-badge">
                <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span className="truncate text-xs text-slate-700 font-medium">
                  {userLocation.name}
                </span>
              </div>
            )}
          </div>

          <div className="providers-list-header">
            <span className="font-semibold text-xs text-slate-600 uppercase tracking-wider">
              {loadingProviders ? 'Searching...' : `${nearbyProviders.length} Nearby Provider${nearbyProviders.length === 1 ? '' : 's'}`}
            </span>
            {userLocation && (
              <span className="text-xs text-slate-500 font-medium">
                Within {radiusKm} km
              </span>
            )}
          </div>

          <div className="providers-scroll-list">
            {!userLocation ? (
              <div className="empty-state-notice">
                <Compass className="w-10 h-10 text-blue-500 mx-auto mb-2" />
                <h3 className="font-semibold text-slate-800 text-sm mb-1">Interactive Map Ready</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mb-3">
                  Please enter a city or address in the search box, or click <strong>Use My Location</strong> to find nearby verified providers.
                </p>
                <button
                  onClick={handleUseCurrentLocation}
                  disabled={geoLocating}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Use My Location</span>
                </button>
              </div>
            ) : loadingProviders ? (
              <div className="loading-state-notice">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Calculating Haversine distance to approved providers...</p>
              </div>
            ) : nearbyProviders.length === 0 ? (
              <div className="empty-state-notice">
                <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="font-semibold text-slate-800 text-sm mb-1">No Providers in this Radius</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mb-3">
                  No approved providers found within {radiusKm} km. Try increasing the search radius or selecting another service.
                </p>
                <button
                  onClick={() => setRadiusKm(35)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                >
                  Expand Radius to 35 km
                </button>
              </div>
            ) : (
              nearbyProviders.map((p) => (
                <div
                  key={p.provider_id}
                  onClick={() => handleSelectProviderCard(p)}
                  className="provider-map-card"
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 leading-snug">{p.provider_name}</h4>
                      <p className="text-xs font-semibold text-blue-600">{p.service}</p>
                    </div>
                    <span className="rating-badge">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span>{p.rating}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      <MapPin className="w-3 h-3 text-red-500" />
                      {p.distance} km away
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      Starts ₹{p.price}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                      {p.availability}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/providers/${p.provider_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-600 hover:text-slate-900 font-semibold text-xs"
                      >
                        Profile
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBookingProvider(p);
                          setBookingSuccess(false);
                          setBookingError('');
                          setServiceAddress(userLocation ? userLocation.name : '');
                        }}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Map Canvas Wrapper */}
        <div className="maps-canvas-wrapper">
          {/* Top-Right Map Engine Switcher Badge */}
          <div className="map-engine-badge-bar">
            <div className="engine-toggle-group">
              <button
                type="button"
                onClick={() => setMapEngine('google')}
                className={`engine-toggle-btn ${mapEngine === 'google' ? 'active' : ''}`}
                title="Use Google Maps Engine"
              >
                <span>Google Maps</span>
                {mapEngine === 'google' && <Check className="w-3 h-3 ml-1" />}
              </button>
              <button
                type="button"
                onClick={() => setMapEngine('leaflet')}
                className={`engine-toggle-btn ${mapEngine === 'leaflet' ? 'active' : ''}`}
                title="Use OpenStreetMap Engine"
              >
                <span>OpenStreetMap</span>
                {mapEngine === 'leaflet' && <Check className="w-3 h-3 ml-1" />}
              </button>
            </div>
          </div>

          {/* Floating Empty Location Notification Overlay */}
          {!userLocation && (
            <div className="map-location-prompt-card">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-slate-900 text-xs">Ready to Search</span>
              </div>
              <p className="text-xs text-slate-600 mb-2 leading-tight">
                Enter your city in the top bar or use your current location to view nearby providers on the map.
              </p>
              <button
                onClick={handleUseCurrentLocation}
                disabled={geoLocating}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Use Current Location</span>
              </button>
            </div>
          )}

          {/* The actual Map Container DOM element */}
          <div
            ref={mapContainerRef}
            className="map-viewport-element"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>

      {/* In-page Booking Modal */}
      {bookingProvider && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Book {bookingProvider.service}</h3>
                  <p className="text-xs text-slate-500">Provider: {bookingProvider.provider_name}</p>
                </div>
              </div>
              <button
                onClick={() => setBookingProvider(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bookingSuccess ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-1">Booking Confirmed!</h4>
                <p className="text-xs text-slate-600 mb-4">
                  Your appointment request has been scheduled with <strong>{bookingProvider.provider_name}</strong>. An email notification has been dispatched to your registered address.
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      setBookingProvider(null);
                      navigate('/bookings');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                  >
                    View in My Bookings
                  </button>
                  <button
                    onClick={() => setBookingProvider(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBookingSubmit} className="p-5 space-y-4">
                {bookingError && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-medium border border-red-200">
                    {bookingError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Service Date</label>
                    <input
                      type="date"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Time</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                    >
                      <option value="09:00">09:00 AM</option>
                      <option value="10:00">10:00 AM</option>
                      <option value="11:30">11:30 AM</option>
                      <option value="14:00">02:00 PM</option>
                      <option value="15:30">03:30 PM</option>
                      <option value="17:00">05:00 PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Service Address</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your complete street address..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={serviceAddress}
                    onChange={(e) => setServiceAddress(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Instructions for Provider</label>
                  <textarea
                    rows={2}
                    placeholder="Describe specific issues, gate codes, or landmarks..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500">Estimated Total:</span>
                    <span className="block font-bold text-slate-900 text-base">₹{bookingProvider.price}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBookingProvider(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={bookingSubmitting}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                    >
                      {bookingSubmitting ? 'Confirming...' : 'Confirm Appointment'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Scoped Page Styles */}
      <style>{`
        .maps-page-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: calc(100vh - 70px);
          overflow: hidden;
          background: #f8fafc;
        }
        .maps-header-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 20px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          z-index: 10;
        }
        .maps-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .icon-wrapper {
          width: 36px;
          height: 36px;
          background: #eff6ff;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .location-search-form {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          max-width: 640px;
        }
        .search-input-wrapper {
          position: relative;
          flex: 1;
        }
        .search-input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
        }
        .location-input {
          width: 100%;
          padding: 8px 32px 8px 36px;
          font-size: 0.85rem;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          outline: none;
          background: #f8fafc;
          transition: all 0.2s;
        }
        .location-input:focus {
          border-color: #2563eb;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .clear-input-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
        }
        .search-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #2563eb;
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 600;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: background 0.15s;
        }
        .search-btn:hover:not(:disabled) {
          background: #1d4ed8;
        }
        .search-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .gps-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #eff6ff;
          color: #1e40af;
          border: 1px solid #bfdbfe;
          font-size: 0.82rem;
          font-weight: 600;
          border-radius: 10px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .gps-btn:hover:not(:disabled) {
          background: #dbeafe;
        }
        .maps-alert-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          border-bottom: 1px solid;
          z-index: 9;
        }
        .maps-alert-banner.warning {
          background: #fffbeb;
          border-color: #fde68a;
        }
        .maps-alert-banner.info {
          background: #eff6ff;
          border-color: #bfdbfe;
        }
        .maps-main-grid {
          display: flex;
          flex: 1;
          height: calc(100% - 62px);
          min-height: 500px;
          overflow: hidden;
          position: relative;
        }
        .maps-sidebar-panel {
          width: 360px;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border-right: 1px solid #e2e8f0;
          z-index: 5;
        }
        @media (max-width: 900px) {
          .maps-sidebar-panel {
            width: 300px;
          }
        }
        .filter-controls-box {
          padding: 14px;
          border-bottom: 1px solid #f1f5f9;
          background: #f8fafc;
        }
        .filter-row {
          margin-bottom: 10px;
        }
        .filter-row:last-child {
          margin-bottom: 0;
        }
        .filter-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 700;
          color: #475569;
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .filter-select {
          width: 100%;
          padding: 6px 10px;
          font-size: 0.8rem;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          outline: none;
        }
        .radius-range-slider {
          width: 100%;
          cursor: pointer;
        }
        .location-active-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          padding: 6px 10px;
          background: #eff6ff;
          border: 1px solid #dbeafe;
          border-radius: 8px;
        }
        .providers-list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 1px solid #f1f5f9;
        }
        .providers-scroll-list {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .provider-map-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .provider-map-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08);
          transform: translateY(-1px);
        }
        .rating-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #0f172a;
          background: #fef3c7;
          padding: 2px 6px;
          border-radius: 6px;
        }
        .empty-state-notice, .loading-state-notice {
          padding: 30px 16px;
          text-align: center;
        }
        .maps-canvas-wrapper {
          flex: 1;
          position: relative;
          min-height: 500px;
          height: 100%;
          background: #e2e8f0;
        }
        .map-viewport-element {
          position: absolute;
          inset: 0;
          width: 100% !important;
          height: 100% !important;
          z-index: 1;
        }
        .map-engine-badge-bar {
          position: absolute;
          top: 14px;
          right: 14px;
          z-index: 10;
        }
        .engine-toggle-group {
          display: flex;
          background: #ffffff;
          border-radius: 10px;
          padding: 3px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          border: 1px solid #cbd5e1;
        }
        .engine-toggle-btn {
          padding: 5px 10px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
          border-radius: 7px;
          display: flex;
          align-items: center;
          transition: all 0.15s;
        }
        .engine-toggle-btn.active {
          background: #2563eb;
          color: #ffffff;
        }
        .map-location-prompt-card {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          border: 1px solid #cbd5e1;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
          border-radius: 14px;
          padding: 12px 18px;
          max-width: 380px;
          width: 90%;
          z-index: 9;
        }
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 16px;
        }
        .modal-card {
          background: #ffffff;
          border-radius: 16px;
          width: 100%;
          max-width: 480px;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #f1f5f9;
        }
      `}</style>
    </div>
  );
}
