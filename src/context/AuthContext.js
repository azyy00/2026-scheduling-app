import React, { createContext, useContext, useState } from 'react';
import { getUser, removeToken, saveToken } from '../utils/auth';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getUser());
  const [loading, setLoading] = useState(false);

  const login = async (credentials, role) => {
    setLoading(true);
    try {
      const endpoint =
        role === 'student' ? '/auth/student-login' : '/auth/login';
      const { data } = await api.post(endpoint, credentials);
      saveToken(data.token);
      setUser(getUser());
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
