import type { JSX } from "react";
import { Button } from "./Button";
import { formatCents } from "~/lib/format";
import { useToast } from "~/shared/hooks/useToast";
import type { CartLine as CartLineData } from "~/types";

interface Props {
  line: CartLineData;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onSetQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}

export function CartLine({ line, onInc, onDec, onSetQty, onRemove }: Props): JSX.Element {
  const { push } = useToast();
  const handleInc = (): void => {
    if (line.qty >= line.product.stock) {
      push("error", `Only ${line.product.stock} in stock`);
      return;
    }
    onInc(line.product.id);
  };
  return (
    <li className="flex items-center gap-2 py-2">
      <div className="flex items-center gap-1" role="group" aria-label={`${line.product.name} quantity`}>
        <Button variant="ghost" size="sm" onClick={() => onDec(line.product.id)} aria-label="Decrease" className="size-10">−</Button>
        <input
          value={line.qty}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === "") return;
            const n = Math.floor(Number(raw));
            if (!Number.isFinite(n) || n <= 0) return;
            if (n > line.product.stock) {
              onSetQty(line.product.id, line.product.stock);
              push("error", `Only ${line.product.stock} in stock`);
              return;
            }
            onSetQty(line.product.id, n);
          }}
          min={1}
          max={line.product.stock}
          className="h-10 w-12 rounded-[var(--radius-md)] border border-[var(--color-border)] text-center text-sm tabular-nums text-[var(--color-text)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)]"
          aria-label="Quantity"
        />
        <Button variant="ghost" size="sm" onClick={handleInc} aria-label="Increase" className="size-10">+</Button>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-text)]">{line.product.name}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{formatCents(line.product.priceCents)} each</p>
      </div>
      <span className="text-sm font-medium tabular-nums text-[var(--color-text)]">{formatCents(line.product.priceCents * line.qty)}</span>
      <Button variant="ghost" size="sm" onClick={() => onRemove(line.product.id)} aria-label={`Remove ${line.product.name}`} className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">✕</Button>
    </li>
  );
}