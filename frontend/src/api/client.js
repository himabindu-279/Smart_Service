const API_BASE_URL = 'http://127.0.0.1:8000/api';

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
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
    const errorMsg = data?.detail || 'Request failed';
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  get: (endpoint, params) => request(endpoint, { method: 'GET', params }),
  post: (endpoint, body, params) => request(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined, params }),
  patch: (endpoint, body, params) => request(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, params }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};
