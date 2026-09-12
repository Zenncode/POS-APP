import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { JSX, ReactNode } from "react";

export type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastCtx = createContext<{ push: (kind: ToastKind, message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-4 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm ${
              t.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : t.kind === "error"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-gray-200 bg-white text-gray-900"
            }`}
          >
            <span
              className={`inline-block size-2 shrink-0 rounded-full ${
                t.kind === "success" ? "bg-emerald-600" : t.kind === "error" ? "bg-red-600" : "bg-gray-400"
              }`}
            />
            <span className="truncate">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): { push: (kind: ToastKind, message: string) => void } {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
