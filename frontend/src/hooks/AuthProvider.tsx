import { createContext, useState, useEffect, ReactNode } from 'react';
import { loginUser, registerUser, logoutUser } from '@/api/auth.api';
import { getWalletBalance } from '@/api/wallet.api';

export interface User {
  id: string;
  name: string;
  email: string;
  balance?: number;
  totalInvested?: number;
  role?: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validate token and fetch user data on app startup
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('user');

        if (token && storedUser) {
          // Restore user from localStorage
          setUser(JSON.parse(storedUser));
        } else if (token && !storedUser) {
          // Token exists but no user data - attempt to fetch current user
          try {
            const apiBase = import.meta.env.VITE_API_URL || '';
          const res = await fetch(`${apiBase}/auth/me`, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            if (res.ok) {
              const data = await res.json();
              const fetchedUser = data.user || data;
              // attempt to fetch wallet balance and attach to user
              try {
                const balance = await getWalletBalance();
                fetchedUser.balance = balance;
              } catch (e) {
                // ignore wallet fetch errors
              }
              setUser(fetchedUser);
              localStorage.setItem('user', JSON.stringify(fetchedUser));
            } else {
              // invalid token
              localStorage.removeItem('authToken');
            }
          } catch (err) {
            localStorage.removeItem('authToken');
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError('Failed to initialize authentication');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await loginUser({ email, password });
      // Debug
      // eslint-disable-next-line no-console
      console.debug('[AuthProvider] login response', response);
      if (response.token) {
        localStorage.setItem('authToken', response.token);
      }
      if (response.refreshToken) {
        localStorage.setItem('refreshToken', response.refreshToken);
      }

      const walletBalance = await (async () => {
        try {
          return await getWalletBalance();
        } catch (e) {
          return response.user?.balance || 0;
        }
      })();

      const normalizeRole = (role?: string) =>
        role?.toString()?.trim()?.toLowerCase() || undefined;

      const userData: User = {
        id: response.user?.id || response.user?.userId || '1',
        name: response.user?.name || response.user?.username || email.split('@')[0],
        email: response.user?.email || email,
        balance: walletBalance,
        totalInvested: 0,
        role: normalizeRole(response.user?.role) || normalizeRole(response.user?.roles),
      };

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (err: any) {
      const errorMessage = err?.message || 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await registerUser({ username: name, email, password });
      // Debug
      // eslint-disable-next-line no-console
      console.debug('[AuthProvider] register response', response);
      if (response.token) {
        localStorage.setItem('authToken', response.token);
      }
      if (response.refreshToken) {
        localStorage.setItem('refreshToken', response.refreshToken);
      }

      const walletBalanceReg = await (async () => {
        try {
          return await getWalletBalance();
        } catch (e) {
          return response.user?.balance || 0;
        }
      })();

      const normalizeRole = (role?: string) =>
        role?.toString()?.trim()?.toLowerCase() || undefined;

      const userData: User = {
        id: response.user?.id || response.user?.userId || '1',
        name: response.user?.name || response.user?.username || name,
        email: response.user?.email || email,
        balance: walletBalanceReg,
        totalInvested: 0,
        role: normalizeRole(response.user?.role) || normalizeRole(response.user?.roles),
      };

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (err: any) {
      const errorMessage = err?.message || 'Registration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);

    try {
      // Call logout endpoint
      await logoutUser();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear local state regardless of API response
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
      setError(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      loading,
      error
    }}>
      {children}
    </AuthContext.Provider>
  );
};
