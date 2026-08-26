"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authClient, AuthState } from "@/lib/auth/client";

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = authClient.subscribe(setState);
    authClient.init();
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await authClient.login(email, password);
  };

  const register = async (username: string, email: string, password: string) => {
    await authClient.register(username, email, password);
  };

  const logout = async () => {
    await authClient.logout();
  };

  const refresh = async () => {
    await authClient.refresh();
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}