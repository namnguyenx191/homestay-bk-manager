import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import client from '../api/client';
import { useLanguage } from './LanguageContext';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { tv } = useLanguage();

  const reloadProfile = async () => {
    const { data } = await client.get('/auth/me');
    setUser(data);
    return data;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) return setLoading(false);
      try {
        await reloadProfile();
      } catch {
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const login = async (payload) => {
    const { data } = await client.post('/auth/login', payload);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    toast.success(tv('Login successful', 'Đăng nhập thành công'));
  };

  const register = async (payload) => {
    const { data } = await client.post('/auth/register', payload);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    toast.success(tv('Account created', 'Tạo tài khoản thành công'));
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    toast.success(tv('Logged out', 'Đã đăng xuất'));
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout, setUser, reloadProfile }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
