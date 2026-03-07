import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import {
  authApi,
  getToken,
  setToken,
  removeToken,
  getStoredUser,
  setStoredUser,
  type User,
} from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone?: string,
    userType?: "buyer" | "seller"
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((u) => {
        setUser(u);
        setStoredUser(u);
      })
      .catch(() => {
        removeToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      phone?: string,
      userType: "buyer" | "seller" = "buyer"
    ): Promise<{ error: Error | null }> => {
      try {
        const res = await authApi.register({
          email,
          password,
          full_name: fullName,
          phone,
          user_type: userType,
        });
        setToken(res.token);
        setStoredUser(res.user);
        setUser(res.user);
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: Error | null }> => {
      try {
        const res = await authApi.login(email, password);
        setToken(res.token);
        setStoredUser(res.user);
        setUser(res.user);
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
    []
  );

  const signOut = useCallback(() => {
    removeToken();
    setUser(null);
    window.location.href = "/";
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await authApi.me();
      setUser(u);
      setStoredUser(u);
    } catch {
      removeToken();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
