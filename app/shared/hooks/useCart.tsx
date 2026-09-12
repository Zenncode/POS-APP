import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import { calcLineTax } from "~/lib/format";
import type { CartLine, CartTotals, Product } from "~/types";

interface CartCtx {
  lines: CartLine[];
  totals: CartTotals;
  count: number;
  add: (p: Product) => void;
  dec: (id: string) => void;
  inc: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  setDiscount: (cents: number) => void;
}

const Ctx = createContext<CartCtx | null>(null);

function compute(lines: CartLine[], discountCents: number): CartTotals {
  const subtotalCents = lines.reduce((s, l) => s + l.product.priceCents * l.qty, 0);
  const taxCents = lines.reduce(
    (s, l) => s + calcLineTax(l.product.priceCents, l.qty, l.product.taxRateBps),
    0,
  );
  const totalCents = Math.max(0, subtotalCents + taxCents - discountCents);
  return { subtotalCents, taxCents, discountCents, totalCents };
}

export function CartProvider({ children }: { children: ReactNode }): JSX.Element {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscountState] = useState(0);

  const add = useCallback((p: Product) => {
    setLines((prev) => {
      const found = prev.find((l) => l.product.id === p.id);
      if (found) {
        return prev.map((l) => (l.product.id === p.id ? { ...l, qty: Math.min(1000, l.qty + 1) } : l));
      }
      return [...prev, { product: p, qty: 1 }];
    });
  }, []);

  const inc = useCallback((id: string) => {
    setLines((prev) => prev.map((l) => (l.product.id === id ? { ...l, qty: Math.min(1000, l.qty + 1) } : l)));
  }, []);

  const dec = useCallback((id: string) => {
    setLines((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    const q = Math.max(0, Math.min(1000, Math.floor(qty)));
    setLines((prev) =>
      q === 0 ? prev.filter((l) => l.product.id !== id) : prev.map((l) => (l.product.id === id ? { ...l, qty: q } : l)),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.product.id !== id));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setDiscountState(0);
  }, []);

  const setDiscount = useCallback((cents: number) => {
    setDiscountState(Math.max(0, Math.floor(cents)));
  }, []);

  const totals = useMemo(() => compute(lines, discount), [lines, discount]);
  const count = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);

  const value = useMemo(
    () => ({ lines, totals, count, add, dec, inc, setQty, remove, clear, setDiscount }),
    [lines, totals, count, add, dec, inc, setQty, remove, clear, setDiscount],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
