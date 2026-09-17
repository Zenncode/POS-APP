import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { JSX, ReactNode } from "react";

export type ToastKind = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastKind;
  message: string;
}

interface ToastContextValue {
  push: (type: ToastKind, message: string) => void;
  toasts: Toast[];
  remove: (id: string) => void;
}

const ToastCtx = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((type: ToastKind, message: string) => {
    const id = `${Date.now()}-${idRef.current++}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ push, toasts, remove }), [push, remove, toasts]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}