import type { JSX } from "react";
import { Badge } from "./Badge";
import { formatCents } from "~/lib/format";
import type { Product } from "~/types";

interface Props {
  product: Product;
  onAdd: (p: Product) => void;
}

export function ProductTile({ product, onAdd }: Props): JSX.Element {
  const low = product.stock <= product.lowStockThreshold;
  const out = product.stock <= 0;

  return (
    <button
      onClick={() => onAdd(product)}
      disabled={out}
      title={out ? `${product.name} — out of stock` : `Add ${product.name} to cart`}
      className="pos-tile flex h-full min-h-[120px] flex-col rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-left hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <p className="truncate text-sm font-medium text-[var(--color-text)]">{product.name}</p>
      <p className="mt-0.5 text-xs tabular-nums text-[var(--color-text-muted)]">{product.sku}</p>
      <div className="mt-auto flex items-center justify-between">
        <span className="text-lg font-semibold tabular-nums text-[var(--color-primary)]">{formatCents(product.priceCents)}</span>
        {out ? (
          <Badge tone="LOW">Out</Badge>
        ) : low ? (
          <Badge tone="LOW">{product.stock} left</Badge>
        ) : (
          <span className="text-xs tabular-nums text-[var(--color-text-muted)]">×{product.stock}</span>
        )}
      </div>
    </button>
  );
}