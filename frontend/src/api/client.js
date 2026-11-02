const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'
).replace(/\/$/, '');
console.log('API base URL:', API_BASE_URL);
let serviceCategoriesCache;
let serviceCategoriesRequest;
let serviceCategoriesCachedAt = 0;

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let url = `${API_BASE_URL}${endpoint}`;
  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, val);
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const details = data?.detail;
    const errorMsg = Array.isArray(details)
      ? details.map((item) => item.msg).filter(Boolean).join('; ')
      : details || 'Request failed';
    const error = new Error(errorMsg);
    error.status = response.status;
    error.details = details;
    throw error;
  }

  return data;
}

const serializeBody = (body) => (
  typeof FormData !== 'undefined' && body instanceof FormData
    ? body
    : body ? JSON.stringify(body) : undefined
);

export const api = {
  get: (endpoint, params) => request(endpoint, { method: 'GET', params }),
  post: (endpoint, body, params) => request(endpoint, { method: 'POST', body: serializeBody(body), params }),
  put: (endpoint, body, params) => request(endpoint, { method: 'PUT', body: serializeBody(body), params }),
  patch: (endpoint, body, params) => request(endpoint, { method: 'PATCH', body: serializeBody(body), params }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
  download: async (endpoint) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.detail || 'Unable to download this document.');
    }
    return response.blob();
  },
};

export function getServiceCategories() {
  if (serviceCategoriesCache && Date.now() - serviceCategoriesCachedAt < 30000) {
    return Promise.resolve(serviceCategoriesCache);
  }

  if (!serviceCategoriesRequest) {
    serviceCategoriesRequest = api.get('/categories')
      .then((categories) => {
        serviceCategoriesCache = categories;
        serviceCategoriesCachedAt = Date.now();
        return categories;
      })
      .finally(() => {
        serviceCategoriesRequest = null;
      });
  }

  return serviceCategoriesRequest;
}
