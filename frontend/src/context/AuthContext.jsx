import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);
const currentTerm = () => new Date().getMonth() >= 6 ? 'july-december' : 'january-june';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionDetails, setSessionDetails] = useState([]);
  const [selectedSession, setSelectedSessionState] = useState(() => localStorage.getItem('erp_academic_session') || '');
  const [selectedTerm, setSelectedTermState] = useState(() => localStorage.getItem('erp_academic_term') || currentTerm());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('erp_access_token');
    if (token) {
      api.get('/auth/me')
        .then(({ data }) => {
          setUser(data.data.user);
          return api.get('/auth/sessions');
        })
        .then(({ data }) => {
          const available = data.data.sessions || [];
          setSessionDetails(data.data.details || []);
          setSessions(available);
          const saved = localStorage.getItem('erp_academic_session');
          const next = saved && available.includes(saved) ? saved : (data.data.currentSession || available[0] || '');
          if (next) localStorage.setItem('erp_academic_session', next);
          const selectedDetails = (data.data.details || []).find(item => item.session === next);
          localStorage.setItem('erp_academic_term', selectedDetails?.term || currentTerm());
          setSelectedTermState(selectedDetails?.term || currentTerm());
          setSelectedSessionState(next);
        })
        .catch(err => {
          if (err.response?.status === 401) {
            localStorage.removeItem('erp_access_token');
            localStorage.removeItem('erp_refresh_token');
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email, password, role) => {
    const { data } = await api.post('/auth/login', { email, password, role });
    localStorage.setItem('erp_access_token', data.data.accessToken);
    localStorage.setItem('erp_refresh_token', data.data.refreshToken);
    setUser(data.data.user);
    const sessionData = await api.get('/auth/sessions');
    const available = sessionData.data.data.sessions || [];
    const next = sessionData.data.data.currentSession || available[0] || '';
    setSessions(available);
    setSessionDetails(sessionData.data.data.details || []);
    if (next) {
      localStorage.setItem('erp_academic_session', next);
      const selectedDetails = (sessionData.data.data.details || []).find(item => item.session === next);
      localStorage.setItem('erp_academic_term', selectedDetails?.term || currentTerm());
      setSelectedTermState(selectedDetails?.term || currentTerm());
      setSelectedSessionState(next);
    }
    return data.data.user;
  };

  const logout = () => {
    localStorage.removeItem('erp_access_token');
    localStorage.removeItem('erp_refresh_token');
    localStorage.removeItem('erp_academic_session');
    localStorage.removeItem('erp_academic_term');
    setSessions([]);
    setSessionDetails([]);
    setSelectedSessionState('');
    setSelectedTermState(currentTerm());
    setUser(null);
  };

  const setSelectedSession = (session) => {
    if (!sessions.includes(session)) return;
    localStorage.setItem('erp_academic_session', session);
    const selectedDetails = sessionDetails.find(item => item.session === session);
    localStorage.setItem('erp_academic_term', selectedDetails?.term || currentTerm());
    setSelectedTermState(selectedDetails?.term || currentTerm());
    setSelectedSessionState(session);
    window.location.reload();
  };

  const setSelectedTerm = (term) => {
    if (!['july-december', 'january-june'].includes(term)) return;
    localStorage.setItem('erp_academic_term', term);
    setSelectedTermState(term);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, isLoading, login, logout, sessions, sessionDetails, selectedSession, setSelectedSession, selectedTerm, setSelectedTerm }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
