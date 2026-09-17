import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductTile } from "~/shared/components/ui/ProductTile";
import type { Product } from "~/types";

const product: Product = {
  id: "p1",
  sku: "C-1",
  barcode: null,
  name: "Coffee",
  categoryId: null,
  priceCents: 150,
  costCents: null,
  taxRateBps: 0,
  stock: 10,
  lowStockThreshold: 2,
  isActive: true,
};

const outOfStockProduct: Product = { ...product, stock: 0 };
const lowStockProduct: Product = { ...product, stock: 2 };

describe("ProductTile — mutation killers", () => {
  // Kills: onAdd called with product when clicked
  it("calls onAdd with product when clicked", () => {
    const onAdd = vi.fn();
    render(<ProductTile product={product} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: /Coffee/ }));
    expect(onAdd).toHaveBeenCalledWith(product);
  });

  // Kills: disabled when out of stock
  it("is disabled when stock <= 0", () => {
    render(<ProductTile product={outOfStockProduct} onAdd={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Coffee/ });
    expect(btn).toBeDisabled();
  });

  // Kills: title shows out of stock when stock <= 0
  it("shows out of stock title when stock <= 0", () => {
    render(<ProductTile product={outOfStockProduct} onAdd={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAttribute("title", "Coffee — out of stock");
  });

  // Kills: title shows add to cart when in stock
  it("shows add to cart title when in stock", () => {
    render(<ProductTile product={product} onAdd={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAttribute("title", "Add Coffee to cart");
  });

  // Kills: low stock badge when stock <= lowStockThreshold
  it("shows LOW badge with stock count when stock <= lowStockThreshold", () => {
    render(<ProductTile product={lowStockProduct} onAdd={vi.fn()} />);
    expect(screen.getByText("2 left")).toBeInTheDocument();
  });

  // Kills: out badge when stock <= 0
  it("shows Out badge when stock <= 0", () => {
    render(<ProductTile product={outOfStockProduct} onAdd={vi.fn()} />);
    expect(screen.getByText("Out")).toBeInTheDocument();
  });

  // Kills: stock count when in stock and not low
  it("shows stock count when in stock and above threshold", () => {
    render(<ProductTile product={product} onAdd={vi.fn()} />);
    expect(screen.getByText("×10")).toBeInTheDocument();
  });

  // Kills: product name displayed
  it("displays product name", () => {
    render(<ProductTile product={product} onAdd={vi.fn()} />);
    expect(screen.getByText("Coffee")).toBeInTheDocument();
  });

  // Kills: sku displayed
  it("displays SKU", () => {
    render(<ProductTile product={product} onAdd={vi.fn()} />);
    expect(screen.getByText("C-1")).toBeInTheDocument();
  });

  // Kills: price displayed formatted (uses ₱ symbol)
  it("displays price formatted", () => {
    render(<ProductTile product={product} onAdd={vi.fn()} />);
    expect(screen.getByText("₱1.50")).toBeInTheDocument();
  });

  // Kills: correct classes for hover/focus
  it("applies hover and focus-visible classes", () => {
    render(<ProductTile product={product} onAdd={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Coffee/ });
    expect(btn).toHaveClass("hover:border-[var(--color-primary)]");
    expect(btn).toHaveClass("focus-visible:ring-2");
    expect(btn).toHaveClass("focus-visible:ring-[var(--color-primary-focus)]");
  });

  // Kills: cursor-not-allowed and opacity-60 when disabled
  it("applies disabled styles when out of stock", () => {
    render(<ProductTile product={outOfStockProduct} onAdd={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Coffee/ });
    expect(btn).toHaveClass("disabled:cursor-not-allowed");
    expect(btn).toHaveClass("disabled:opacity-60");
  });
});