import { createContext, useContext, useEffect, useState } from 'react';
import { api, loadToken, setToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadToken()
      .then((t) => (t ? api('/auth/me').then(({ data }) => setUser(data.user)) : null))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (path, body) => {
    const { data } = await api(path, { method: 'POST', body });
    await setToken(data.token);
    setUser(data.user);
  };

  const value = {
    user,
    loading,
    login: (b) => signIn('/auth/login', b),
    register: (b) => signIn('/auth/register', b),
    logout: async () => { await setToken(null); setUser(null); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
