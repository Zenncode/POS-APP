import { useEffect } from "react";
import type { JSX, ReactNode } from "react";

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-gray-900/40" />
      <div className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-[14px] border border-gray-200 bg-white p-6 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label="Close dialog">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
