const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1';

export async function request(endpoint, options = {}) {
  const isFormData = options.body instanceof FormData;
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const config = {
    ...options,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  if (options.body && !isFormData && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, config);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.message || 'Lỗi kết nối máy chủ');
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (url, opts) => request(url, { ...opts, method: 'GET' }),
  post: (url, body, opts) => request(url, { ...opts, method: 'POST', body }),
  put: (url, body, opts) => request(url, { ...opts, method: 'PUT', body }),
  delete: (url, opts) => request(url, { ...opts, method: 'DELETE' }),
};

export default api;
