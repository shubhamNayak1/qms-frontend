import React, { createContext, useContext, useState, useCallback } from 'react';
import { loginApi } from '../api/authApi';
import { getToken, setToken, removeToken, getUser, setUser } from '../utils/helpers';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(() => getToken());
  const [user, setUserState] = useState(() => getUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (credentials) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await loginApi(credentials);

      // Response shape: { success, message, data: { accessToken, userId, username, ... } }
      const payload = data.data || data;
      const jwt = payload.accessToken || payload.token || payload.jwt || payload.access_token;

      if (!jwt) throw new Error('Token not found in response');

      const userData = {
        id: payload.userId,
        name: payload.fullName || payload.username,
        email: payload.email,
        username: payload.username,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
      };

      setToken(jwt);
      setUser(userData);
      setTokenState(jwt);
      setUserState(userData);
      return { success: true };
    } catch (err) {
      const msg = err.message?.startsWith('Token field')
        ? err.message
        : err.response?.data?.message || err.response?.data?.error || 'Login failed. Check credentials.';
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setTokenState(null);
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, error, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
