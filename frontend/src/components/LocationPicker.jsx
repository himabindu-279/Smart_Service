import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';

const DEFAULT_CENTER = [20.5937, 78.9629];

export default function LocationPicker({
  value,
  onChange,
  label = 'Service location',
  showRadius = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const [query, setQuery] = useState(value?.address || '');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = value;
  }, [onChange, value]);

  useEffect(() => {
    if (value?.address) setQuery(value.address);
  }, [value?.address]);

  const publishLocation = useCallback((latitude, longitude, address = '') => {
    const next = {
      ...(valueRef.current || {}),
      address: address || `Map pin: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      latitude,
      longitude,
    };
    valueRef.current = next;
    onChangeRef.current?.(next);
    setQuery(next.address);
    return next;
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    map.on('click', (event) => publishLocation(event.latlng.lat, event.latlng.lng));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [publishLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || value?.latitude == null || value?.longitude == null) return;

    const point = [Number(value.latitude), Number(value.longitude)];
    if (!markerRef.current) {
      markerRef.current = L.marker(point, { draggable: true }).addTo(map);
      markerRef.current.on('dragend', (event) => {
        const position = event.target.getLatLng();
        publishLocation(position.lat, position.lng);
      });
    } else {
      markerRef.current.setLatLng(point);
    }
    if (showRadius) {
      const radiusMeters = Number(value.radius_km || 15) * 1000;
      if (!circleRef.current) {
        circleRef.current = L.circle(point, { radius: radiusMeters, color: '#f97316', fillOpacity: 0.08 }).addTo(map);
      } else {
        circleRef.current.setLatLng(point).setRadius(radiusMeters);
      }
    }
    map.setView(point, Math.max(map.getZoom(), 12));
  }, [publishLocation, showRadius, value?.latitude, value?.longitude, value?.radius_km]);

  const searchAddress = async () => {
    if (!query.trim()) {
      setError('Enter a location to search.');
      return;
    }
    setSearching(true);
    setError('');
    try {
      const matches = await api.get('/maps/geocode', { query: query.trim() });
      if (!matches.length) {
        setError('Location not found. Try a city, area, or address.');
        return;
      }
      const match = matches[0];
      const next = publishLocation(Number(match.latitude), Number(match.longitude), match.display_name);
      mapRef.current?.setView([next.latitude, next.longitude], 14);
    } catch (requestError) {
      setError(requestError.message || 'Unable to search this location.');
    } finally {
      setSearching(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('This browser does not support GPS location.');
      return;
    }
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        publishLocation(coords.latitude, coords.longitude, 'GPS location');
        mapRef.current?.setView([coords.latitude, coords.longitude], 14);
      },
      () => setError('Location permission was denied or GPS is unavailable.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const updateRadius = (radiusKm) => {
    const next = { ...(valueRef.current || {}), radius_km: Number(radiusKm) };
    valueRef.current = next;
    onChangeRef.current?.(next);
  };
  const inputId = `location-query-${label.replace(/\W/g, '-')}`;

  return (
    <section className="location-picker" aria-label={label}>
      <div className="location-picker__search">
        <label htmlFor={inputId}>{label}</label>
        <div>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                searchAddress();
              }
            }}
            placeholder="Search city, area, or address"
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={searchAddress} disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={useCurrentLocation}>
            Use GPS
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="location-picker__map"
        role="application"
        aria-label="Interactive map; click to place or drag the marker"
      />
      <p className="location-picker__preview">
        {value?.latitude != null && value?.longitude != null
          ? `${value.address || 'Pinned location'} - ${Number(value.latitude).toFixed(5)}, ${Number(value.longitude).toFixed(5)}`
          : 'Search for an address, use GPS, or click the map to place a marker.'}
      </p>
      {showRadius && (
        <label className="location-picker__radius">
          Coverage radius: <strong>{Number(value?.radius_km || 15)} km</strong>
          <input
            type="range"
            min="1"
            max="200"
            value={Number(value?.radius_km || 15)}
            onChange={(event) => updateRadius(event.target.value)}
          />
        </label>
      )}
      {error && <p className="location-picker__error" role="alert">{error}</p>}
    </section>
  );
}