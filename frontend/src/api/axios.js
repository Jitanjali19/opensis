import axios from 'axios';
import toast from 'react-hot-toast';

const base = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL: base });
const getUserFacingError = (error) => {
  const message = error?.response?.data?.message || '';
  if (/E11000|duplicate key|duplicate index/i.test(message)) {
    return 'This code is already in use. Please enter a different code.';
  }
  return message || 'Something went wrong';
};

api.interceptors.request.use(config => {
  const token = localStorage.getItem('erp_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const session = localStorage.getItem('erp_academic_session');
  if (session) config.headers['X-Academic-Session'] = session;
  const term = localStorage.getItem('erp_academic_term')
    || (new Date().getMonth() >= 6 ? 'july-december' : 'january-june');
  config.headers['X-Academic-Term'] = term;
  return config;
});

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('erp_refresh_token');
        if (!refresh) throw new Error('No refresh token');
        const { data } = await axios.post(`${base}/auth/refresh`, { refreshToken: refresh });
        localStorage.setItem('erp_access_token', data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('erp_access_token');
        localStorage.removeItem('erp_refresh_token');
        window.location.href = '/login';
      }
    }
    
    // Don't show toast for login/auth related errors (they are handled by the component)
    const isAuthError = err.config?.url?.includes('/auth/login') || 
                       err.config?.url?.includes('/auth/refresh') ||
                       err.response?.status === 401 ||
                       err.response?.status === 404;
    
    if (!isAuthError) {
      const message = getUserFacingError(err);
      toast.error(message);
    }
    
    return Promise.reject(err);
  }
);

export default api;
