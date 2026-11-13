import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.service';

const AuthContext = createContext({
  user: null,
  loading: true,
  unverifiedEmail: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
  setUnverifiedEmail: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authService.getMe();
      setUser(res?.user || null);
      return res?.user || null;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (username, password) => {
    try {
      setUnverifiedEmail(null);
      const res = await authService.login({ username, password });
      if (res?.token) {
        localStorage.setItem('token', res.token);
      }
      setUser(res.user);
      return res;
    } catch (err) {
      if (err.data?.unverified) {
        setUnverifiedEmail(err.data.email || username);
      }
      throw err;
    }
  };

  const register = async (payload) => {
    return authService.register(payload);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        unverifiedEmail,
        login,
        register,
        logout,
        refreshUser,
        setUnverifiedEmail,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
