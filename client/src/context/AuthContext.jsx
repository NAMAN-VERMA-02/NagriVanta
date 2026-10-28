import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, hasToken, setToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasToken()) api('/auth/me').then(({ data }) => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
    else setLoading(false);
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const signIn = useCallback(async (path, body) => {
    const { data } = await api(path, { method: 'POST', body });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  // re-read the signed-in user, e.g. after editing the profile
  const refresh = useCallback(() => api('/auth/me').then(({ data }) => setUser(data.user)).catch(() => {}), []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login: (b) => signIn('/auth/login', b), register: (b) => signIn('/auth/register', b), logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
