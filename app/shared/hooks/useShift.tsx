import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import { closeShift as apiClose, getCurrentShift, openShift as apiOpen } from "~/lib/api";
import { useAuth } from "./useAuth";
import type { CashCount, Shift } from "~/types";

interface ShiftState {
  shift: Shift | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  open: (openingFloat: CashCount[], note?: string) => Promise<void>;
  close: (closingFloat: CashCount[], note?: string) => Promise<void>;
}

const Ctx = createContext<ShiftState | null>(null);

export function ShiftProvider({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useAuth();
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setShift(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setShift(await getCurrentShift());
      setError(null);
    } catch {
      setError("Couldn't check shift status. Retry.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = useCallback(async (openingFloat: CashCount[], note?: string) => {
    setShift(await apiOpen(openingFloat, note));
    setError(null);
  }, []);

  const close = useCallback(async (closingFloat: CashCount[], note?: string) => {
    await apiClose(closingFloat, note);
    setShift(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ shift, loading, error, refresh, open, close }),
    [shift, loading, error, refresh, open, close],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShift(): ShiftState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShift must be used inside ShiftProvider");
  return ctx;
}
