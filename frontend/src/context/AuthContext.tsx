import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as api from "../api/client";
import type { UserPublic } from "../api/types";

type AuthState = {
  user: UserPublic | null;
  loading: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    try {
      const u = await api.me();
      setUser(u);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    (async () => {
      await refreshMe();
      setLoading(false);
    })();
  }, []);

  async function doLogin(username: string, password: string) {
    const t = await api.login(username, password);
    localStorage.setItem("access_token", t.access_token);
    await refreshMe();
  }

  function logout() {
    localStorage.removeItem("access_token");
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, login: doLogin, logout, refreshMe }),
    [user, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
