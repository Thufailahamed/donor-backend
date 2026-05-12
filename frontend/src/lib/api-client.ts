import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  withCredentials: true,
});

// Add auth token to every request
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ides_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const userId = localStorage.getItem('ides_user_id');
    if (userId) {
      config.headers['x-user-id'] = userId;
    }
  }
  return config;
});

// Handle 401 responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Optionally redirect to login
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/join')) {
        // Don't redirect for public pages
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
