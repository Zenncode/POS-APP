import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import { fetchMe, login as apiLogin, logout as apiLogout } from "~/lib/api";
import { DEMO_USER } from "~/lib/demoData";
import { clearTokens, getAccessToken } from "~/lib/httpClient";
import type { StaffUser } from "~/types";

interface AuthState {
  user: StaffUser | null;
  loading: boolean;
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const onDemo = (e: Event): void => {
      const v = (e as CustomEvent<boolean>).detail;
      setDemoMode(v);
    };
    window.addEventListener("pos:demo", onDemo);
    return () => window.removeEventListener("pos:demo", onDemo);
  }, []);

  useEffect(() => {
    let alive = true;
    async function boot(): Promise<void> {
      const token = getAccessToken();
      if (!token) {
        if (alive) setLoading(false);
        return;
      }
      if (token === "demo.access") {
        if (alive) {
          setUser(DEMO_USER);
          setDemoMode(true);
          setLoading(false);
        }
        return;
      }
      try {
        const me = await fetchMe();
        if (alive) setUser(me);
      } catch {
        clearTokens();
      } finally {
        if (alive) setLoading(false);
      }
    }
    void boot();
    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user: u } = await apiLogin(email.trim(), password);
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setDemoMode(false);
  }, []);

  const value = useMemo(() => ({ user, loading, demoMode, signIn, signOut }), [user, loading, demoMode, signIn, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function roleAtLeast(role: StaffUser["role"] | undefined, min: StaffUser["role"]): boolean {
  const rank: Record<string, number> = { CASHIER: 1, MANAGER: 2, ADMIN: 3 };
  return (rank[role ?? ""] ?? 0) >= (rank[min] ?? 99);
}
