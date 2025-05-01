import { createContext, useState, useContext, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const { toast } = useToast();
  const [authState, setAuthState] = useState({
    user: null,
    token: localStorage.getItem('access_token'),
    refreshToken: localStorage.getItem('refresh_token'),
    isAuthenticated: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      const storedUser = localStorage.getItem('user');

      if (storedUser && token && refreshToken) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setAuthState((prev) => ({
            ...prev,
            user: parsedUser,
            token,
            refreshToken,
            isAuthenticated: true,
            loading: false,
          }));
          return;
        } catch (e) {
          console.error('Failed to parse stored user:', e);
        }
      }

      if (!token || !refreshToken) {
        setAuthState((prev) => ({ ...prev, loading: false }));
        return;
      }

      try {
        const response = await axios.get('http://localhost:8000/api/accounts/user/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const userData = response.data;
        setAuthState((prev) => ({
          ...prev,
          user: userData,
          token,
          refreshToken,
          isAuthenticated: true,
          loading: false,
        }));
        localStorage.setItem('user', JSON.stringify(userData));
      } catch (error) {
        if (error.response?.status === 401 && refreshToken) {
          try {
            const refreshResponse = await axios.post('http://localhost:8000/api/token/refresh/', {
              refresh: refreshToken,
            });
            const newToken = refreshResponse.data.access;
            localStorage.setItem('access_token', newToken);
            const userResponse = await axios.get('http://localhost:8000/api/accounts/user/', {
              headers: { Authorization: `Bearer ${newToken}` },
            });
            const userData = userResponse.data;
            setAuthState((prev) => ({
              ...prev,
              user: userData,
              token: newToken,
              refreshToken,
              isAuthenticated: true,
              loading: false,
            }));
            localStorage.setItem('user', JSON.stringify(userData));
          } catch (refreshError) {
            clearAuthState();
          }
        } else {
          clearAuthState();
        }
      }
    };
    loadUser();
  }, []);

  const clearAuthState = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setAuthState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  };

  const login = async (username, password) => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));
      const response = await axios.post('http://localhost:8000/api/accounts/login/', {
        username,
        password,
      });
      const { access_token, refresh_token, role } = response.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);

      const userResponse = await axios.get('http://localhost:8000/api/accounts/user/', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const userData = { ...userResponse.data, role: userResponse.data.role || role };
      localStorage.setItem('user', JSON.stringify(userData));

      setAuthState({
        user: userData,
        token: access_token,
        refreshToken: refresh_token,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
      toast({ title: 'Login successful', description: `Welcome back, ${username}!` });
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      toast({ title: 'Login failed', description: errorMessage, variant: 'destructive' });
      throw error;
    }
  };

  const googleLogin = async (credential) => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));
      const response = await axios.post('http://localhost:8000/api/accounts/google-login/', {
        credential,
      });
      const { access_token, refresh_token, role } = response.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);

      const userResponse = await axios.get('http://localhost:8000/api/accounts/user/', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const userData = { ...userResponse.data, role: userResponse.data.role || role };
      localStorage.setItem('user', JSON.stringify(userData));

      setAuthState({
        user: userData,
        token: access_token,
        refreshToken: refresh_token,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
      toast({ title: 'Google login successful', description: 'Welcome back!' });
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Google login failed';
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      toast({ title: 'Google login failed', description: errorMessage, variant: 'destructive' });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await axios.post(
        'http://localhost:8000/api/accounts/logout/',
        { refresh_token: authState.refreshToken },
        { headers: { Authorization: `Bearer ${authState.token}` } }
      );
    } catch (error) {
      console.error('Logout failed:', error.message);
    }
    clearAuthState();
    toast({ title: 'Logged out', description: 'You have been logged out.' });
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};