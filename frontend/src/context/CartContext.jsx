import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'smartservice.guest-cart';
const CartContext = createContext(null);

function readGuestCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function cartKey(item) {
  return `${item.service_id}:${item.provider_service_id || 'any'}`;
}

function toCartItem(serviceId, providerServiceId = null, details = {}) {
  return {
    service_id: Number(serviceId),
    provider_service_id: providerServiceId ? Number(providerServiceId) : null,
    service_name: details.service_name || 'Service',
    service_slug: details.service_slug || '',
    description: details.description || '',
    booking_date: details.booking_date || null,
    booking_time: details.booking_time || null,
    service_address: details.service_address || null,
    latitude: details.latitude ?? null,
    longitude: details.longitude ?? null,
    special_instructions: details.special_instructions || '',
    guest_key: cartKey({ service_id: serviceId, provider_service_id: providerServiceId }),
  };
}

export function CartProvider({ children }) {
  const { user, token } = useAuth();
  const [cart, setCart] = useState({ items: [], subtotal: 0, price_quote_complete: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!token || user?.role !== 'USER') {
      const items = readGuestCart();
      const guestItems = items.map((item) => ({
        ...item,
        id: item.guest_key,
        price: null,
        offers: [],
        selected_provider: null,
      }));
      setCart({ items: guestItems, subtotal: 0, price_quote_complete: false });
      return { items: guestItems, subtotal: 0, price_quote_complete: false };
    }

    const currentCart = await api.get('/cart');
    setCart(currentCart);
    return currentCart;
  }, [token, user?.role]);

  useEffect(() => {
    let active = true;
    const synchronizeCart = async () => {
      setLoading(true);
      setError('');
      if (!token || user?.role !== 'USER') {
        const items = readGuestCart().map((item) => ({
          ...item,
          id: item.guest_key,
          price: null,
          offers: [],
          selected_provider: null,
        }));
        if (active) {
          setCart({ items, subtotal: 0, price_quote_complete: false });
          setLoading(false);
        }
        return;
      }

      const guestItems = readGuestCart();
      try {
        for (const guestItem of guestItems) {
          const result = await api.post('/cart/items', {
            service_id: guestItem.service_id,
            provider_service_id: guestItem.provider_service_id,
          });
          if (guestItem.booking_date && guestItem.booking_time) {
            await api.put(`/cart/items/${result.item.id}`, {
              booking_date: guestItem.booking_date,
              booking_time: guestItem.booking_time,
              service_address: guestItem.service_address || undefined,
              latitude: guestItem.latitude ?? undefined,
              longitude: guestItem.longitude ?? undefined,
              special_instructions: guestItem.special_instructions || undefined,
            });
          }
        }
        localStorage.removeItem(STORAGE_KEY);
      } catch (syncError) {
        if (active) setError(syncError.message || 'Guest cart items could not be merged yet.');
      }

      try {
        const serverCart = await api.get('/cart');
        if (active) {
          if (guestItems.length && readGuestCart().length) {
            const serverKeys = new Set(serverCart.items.map(cartKey));
            const remainingGuest = readGuestCart()
              .filter((item) => !serverKeys.has(cartKey(item)))
              .map((item) => ({ ...item, id: item.guest_key, offers: [], price: null }));
            setCart({
              ...serverCart,
              items: [...serverCart.items, ...remainingGuest],
              price_quote_complete: serverCart.price_quote_complete && remainingGuest.length === 0,
            });
          } else {
            setCart(serverCart);
          }
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Your cart could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };

    synchronizeCart();
    return () => { active = false; };
  }, [token, user?.id, user?.role]);

  const addItem = useCallback(async ({ serviceId, providerServiceId = null, ...details }) => {
    const item = toCartItem(serviceId, providerServiceId, details);
    setError('');
    try {
      if (token && user?.role === 'USER') {
        const result = await api.post('/cart/items', {
          service_id: item.service_id,
          provider_service_id: item.provider_service_id,
        });
        if (item.booking_date && item.booking_time) {
          await api.put(`/cart/items/${result.item.id}`, {
            booking_date: item.booking_date,
            booking_time: item.booking_time,
            service_address: item.service_address || undefined,
            latitude: item.latitude ?? undefined,
            longitude: item.longitude ?? undefined,
            special_instructions: item.special_instructions || undefined,
          });
        }
        await refresh();
        return result.item;
      }

      const existing = readGuestCart();
      const next = existing.some((entry) => cartKey(entry) === cartKey(item))
        ? existing
        : [...existing, item];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setCart({
        items: next.map((entry) => ({ ...entry, id: entry.guest_key, offers: [], price: null })),
        subtotal: 0,
        price_quote_complete: false,
      });
      return item;
    } catch (mutationError) {
      setError(mutationError.message || 'The service could not be added to your cart.');
      throw mutationError;
    }
  }, [refresh, token, user?.role]);

  const updateItem = useCallback(async (itemId, updates) => {
    setError('');
    try {
      if (token && user?.role === 'USER') {
        const updated = await api.put(`/cart/items/${itemId}`, updates);
        await refresh();
        return updated;
      }
      const existing = readGuestCart();
      const next = existing.map((item) => item.guest_key === itemId
        ? { ...item, ...updates }
        : item);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      await refresh();
      return next.find((item) => item.guest_key === itemId);
    } catch (mutationError) {
      setError(mutationError.message || 'The cart item could not be updated.');
      throw mutationError;
    }
  }, [refresh, token, user?.role]);

  const removeItem = useCallback(async (itemId) => {
    setError('');
    try {
      if (token && user?.role === 'USER') {
        await api.delete(`/cart/items/${itemId}`);
        await refresh();
        return;
      }
      const next = readGuestCart().filter((item) => item.guest_key !== itemId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      await refresh();
    } catch (mutationError) {
      setError(mutationError.message || 'The cart item could not be removed.');
      throw mutationError;
    }
  }, [refresh, token, user?.role]);

  const itemCount = cart.items.length;

  const value = useMemo(() => ({
    ...cart,
    itemCount,
    loading,
    error,
    addItem,
    updateItem,
    removeItem,
    refresh,
    clearError: () => setError(''),
  }), [cart, itemCount, loading, error, addItem, updateItem, removeItem, refresh]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
