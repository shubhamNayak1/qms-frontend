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
  profilePictureUrl: me.profilePictureUrl || null,
  isActive: me.isActive ?? true,
  lastLoginAt: me.lastLoginAt || null,
  mustChangePassword: me.mustChangePassword ?? false,
  roles: me.roles || [],
  permissions: me.permissionSet || [],
  permissionsByModule: me.permissionsByModule || {},
  moduleAccess: me.moduleAccess || {},
});

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(() => getToken());
  const [user, setUserState] = useState(() => getUser());
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(!!getToken());
  const [error, setError] = useState(null);

  // On mount: if token exists, fetch /auth/me to get fresh profile + mustChangePassword
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

      // Fetch full profile + moduleAccess + mustChangePassword
      const meRes = await getMeApi();
      const me = meRes.data?.data || meRes.data;
      const userData = buildUserFromMe(me);
      setUser(userData);
      setUserState(userData);

      return { success: true, mustChangePassword: userData.mustChangePassword };
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

  // Called after a successful forced password change — clears the flag without a full re-login
  const clearMustChangePassword = useCallback(() => {
    setUserState((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, mustChangePassword: false };
      setUser(updated);
      return updated;
    });
  }, []);

  // Helper: check if user can access a module key (USER, QMS, DMS, LMS, REPORT, AUDIT)
  const moduleAccess = user?.moduleAccess;
  const canAccessModule = useCallback((moduleKey) => {
    if (!moduleAccess) return true;
    if (!(moduleKey in moduleAccess)) return true;
    return moduleAccess[moduleKey] === true;
  }, [moduleAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // Role helpers
  const hasRole = useCallback((role) => {
    return Array.isArray(user?.roles) && user.roles.includes(role);
  }, [user?.roles]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSuperAdmin = hasRole('SUPER_ADMIN');

  return (
    <AuthContext.Provider value={{
      token, user, loading, bootstrapping, error,
      login, logout, clearMustChangePassword,
      isAuthenticated: !!token,
      mustChangePassword: user?.mustChangePassword ?? false,
      canAccessModule,
      hasRole,
      isSuperAdmin,
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
