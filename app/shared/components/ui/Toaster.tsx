import { useToast } from "~/shared/hooks/useToast";
import type { JSX } from "react";
import { Button } from "./Button";

export function Toaster(): JSX.Element {
  const { toasts, remove } = useToast();
  return (
    <div suppressHydrationWarning className="fixed top-4 right-4 z-[var(--z-toast)] flex w-full max-w-md flex-col gap-2" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-[var(--radius-md)] border p-4 shadow-[var(--shadow-sm)] bg-[var(--color-bg)] ${
            t.type === "success" ? "border-[var(--color-success-soft)]" : t.type === "error" ? "border-[var(--color-danger-soft)]" : "border-[var(--color-info-soft)]"
          }`}
          role="alert"
        >
          <span className="flex-1 text-sm text-[var(--color-text)]">{t.message}</span>
          <Button variant="ghost" size="sm" onClick={() => remove(t.id)} aria-label="Dismiss">✕</Button>
        </div>
      ))}
    </div>
  );
}