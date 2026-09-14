// Offline cart persistence — localStorage-backed (IndexedDB-lite).
// The cart survives reloads / offline blips; server checkout stays source of truth.
// Money stays integer cents; only plain JSON is stored. SSR-safe (guarded).
import type { CartLine } from "~/types";

export const CART_STORAGE_KEY = "pos.cart.v1";

export interface StoredCart {
  lines: CartLine[];
  discountCents: number;
  savedAt: string;
}

function isValidLine(l: unknown): l is CartLine {
  if (typeof l !== "object" || l === null) return false;
  const o = l as { product?: { id?: unknown; priceCents?: unknown }; qty?: unknown };
  return (
    typeof o.product?.id === "string" &&
    typeof o.product?.priceCents === "number" &&
    typeof o.qty === "number" &&
    Number.isFinite(o.qty)
  );
}

export function loadStoredCart(): StoredCart | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCart>;
    const lines = (Array.isArray(parsed.lines) ? parsed.lines : [])
      .filter(isValidLine)
      .map((l) => ({ product: l.product, qty: Math.max(1, Math.min(1000, Math.floor(l.qty))) }));
    const discountCents =
      typeof parsed.discountCents === "number" && Number.isFinite(parsed.discountCents)
        ? Math.max(0, Math.floor(parsed.discountCents))
        : 0;
    return { lines, discountCents, savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "" };
  } catch {
    return null;
  }
}

export function saveStoredCart(lines: CartLine[], discountCents: number): void {
  try {
    if (typeof localStorage === "undefined") return;
    const payload: StoredCart = {
      lines: lines.slice(0, 200),
      discountCents: Math.max(0, Math.floor(discountCents)),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // storage full / unavailable — cart still works in memory
  }
}

export function clearStoredCart(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // ignore
  }
}
