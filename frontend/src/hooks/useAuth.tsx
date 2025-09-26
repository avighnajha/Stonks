import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  balance: number;
  totalInvested: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored token and validate with backend
    const token = localStorage.getItem('authToken');
    if (token) {
      // TODO: Validate token with your NestJS backend
      // For now, using mock user data
      setUser({
        id: '1',
        name: 'Alex Thompson',
        email: 'alex.thompson@email.com',
        balance: 15420.50,
        totalInvested: 8580.00
      });
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // TODO: Replace with actual API call to your NestJS backend
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      localStorage.setItem('authToken', data.token);
      setUser(data.user);
    } catch (error) {
      // Mock successful login for demo
      localStorage.setItem('authToken', 'mock-token');
      setUser({
        id: '1',
        name: 'Alex Thompson',
        email: email,
        balance: 15420.50,
        totalInvested: 8580.00
      });
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      // TODO: Replace with actual API call to your NestJS backend
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }
      
      localStorage.setItem('authToken', data.token);
      setUser(data.user);
    } catch (error) {
      // Mock successful registration for demo
      localStorage.setItem('authToken', 'mock-token');
      setUser({
        id: '1',
        name: name,
        email: email,
        balance: 15420.50,
        totalInvested: 8580.00
      });
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};