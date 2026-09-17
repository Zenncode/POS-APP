import { useEffect, useRef } from "react";
import type { JSX, ReactNode, RefObject } from "react";

function useFocusTrap(enabled: boolean, containerRef: RefObject<HTMLDivElement | null>, initialFocusRef?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    const container = containerRef.current;
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          (typeof el.checkVisibility === "function"
            ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
            : el.offsetParent !== null),
      );
    const focusable = getFocusable();
    if (focusable.length === 0) return;
    const first = focusable[0];
    if (initialFocusRef?.current) initialFocusRef.current.focus(); else first.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const current = getFocusable();
      if (current.length === 0) return;
      const firstEl = current[0];
      const lastEl = current[current.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      } else {
        if (document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [enabled, containerRef, initialFocusRef]);
}

export function Modal({
  title,
  onClose,
  children,
  wide,
  initialFocus,
  returnFocusOnClose = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocusOnClose?: boolean;
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    previousActive.current = document.activeElement as HTMLElement;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useFocusTrap(true, containerRef, initialFocus);

  useEffect(() => {
    return () => { if (returnFocusOnClose) previousActive.current?.focus(); };
  }, [returnFocusOnClose]);

  return (
    <div className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[var(--color-overlay)]" />
      <div ref={containerRef} className={`pos-sheet relative w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-[var(--shadow-sm)]`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]" aria-label="Close dialog">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}