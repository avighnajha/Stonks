import { createContext, useState, useEffect, ReactNode } from "react";
import { loginUser, registerUser, logoutUser } from "@/api/auth.api";
import axios from "@/api/axiosInstance";
import { getWalletBalance } from "@/api/wallet.api";
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
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const load = async () => {
    const { data } = await axios.get("/auth/me");
    const next = { ...data.user, balance: await getWalletBalance() };
    localStorage.setItem("user", JSON.stringify(next));
    setUser(next);
  };
  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        if (localStorage.getItem("authToken")) await load();
        else setUser(null);
      } catch {
        if (active) {
          setUser(null);
          setError("Could not restore your session. Please sign in again.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    const expired = () => {
      setUser(null);
      setError("Session expired. Please sign in again.");
    };
    const storage = (e: StorageEvent) => {
      if (e.key === "authToken") void init();
    };
    const updated = () => {
      if (localStorage.getItem("authToken"))
        void getWalletBalance()
          .then((balance) => setUser((u) => (u ? { ...u, balance } : u)))
          .catch(() => {});
    };
    void init();
    window.addEventListener("auth:unauthorized", expired);
    window.addEventListener("storage", storage);
    window.addEventListener("portfolio:updated", updated);
    return () => {
      active = false;
      window.removeEventListener("auth:unauthorized", expired);
      window.removeEventListener("storage", storage);
      window.removeEventListener("portfolio:updated", updated);
    };
  }, []);
  const authenticate = async (action: () => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (e: any) {
      setError(e.message || "Authentication failed");
      throw e;
    } finally {
      setLoading(false);
    }
  };
  const login = (email: string, password: string) =>
    authenticate(() => loginUser({ email, password }));
  const register = (name: string, email: string, password: string) =>
    authenticate(() => registerUser({ username: name, email, password }));
  const logout = async () => {
    await logoutUser();
    localStorage.removeItem("user");
    setUser(null);
    setError(null);
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        loading,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
