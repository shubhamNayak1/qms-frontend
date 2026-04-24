import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { loginApi, getMeApi } from '../api/authApi';
import { getToken, setToken, removeToken, getUser, setUser } from '../utils/helpers';

const AuthContext = createContext(null);

const buildUserFromMe = (me) => ({
  id: me.id,
  name: me.fullName || me.username,
  email: me.email,
  username: me.username,
  firstName: me.firstName,
  lastName: me.lastName,
  phone: me.phone,
  department: me.department,
  designation: me.designation,
  employeeId: me.employeeId,
  roles: me.roles || [],
  permissions: me.permissionSet || [],
  permissionsByModule: me.permissionsByModule || {},
  moduleAccess: me.moduleAccess || {},
});

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(() => getToken());
  const [user, setUserState] = useState(() => getUser());
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(!!getToken()); // loading /me on mount
  const [error, setError] = useState(null);

  // On mount: if token exists, fetch /auth/me to get fresh moduleAccess
  useEffect(() => {
    if (!getToken()) { setBootstrapping(false); return; }
    getMeApi()
      .then(({ data }) => {
        const me = data?.data || data;
        const userData = buildUserFromMe(me);
        setUser(userData);
        setUserState(userData);
      })
      .catch(() => {
        // token invalid — clear session
        removeToken();
        setTokenState(null);
        setUserState(null);
      })
      .finally(() => setBootstrapping(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (credentials) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await loginApi(credentials);
      const payload = data.data || data;
      const jwt = payload.accessToken || payload.token || payload.jwt || payload.access_token;
      if (!jwt) throw new Error('Token not found in response');

      setToken(jwt);
      setTokenState(jwt);

      // Fetch full profile + moduleAccess
      const meRes = await getMeApi();
      const me = meRes.data?.data || meRes.data;
      const userData = buildUserFromMe(me);
      setUser(userData);
      setUserState(userData);

      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Login failed. Check credentials.';
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

  // Helper: check if user can access a module key (USER, QMS, DMS, LMS, REPORT, AUDIT)
  const canAccessModule = useCallback((moduleKey) => {
    if (!user?.moduleAccess) return true; // fallback: allow if not loaded
    if (!(moduleKey in user.moduleAccess)) return true; // unknown module: allow
    return user.moduleAccess[moduleKey] === true;
  }, [user]);

  return (
    <AuthContext.Provider value={{
      token, user, loading, bootstrapping, error,
      login, logout,
      isAuthenticated: !!token,
      canAccessModule,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
