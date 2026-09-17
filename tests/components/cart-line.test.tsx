import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CartLine } from "~/shared/components/ui/CartLine";
import type { CartLine as CartLineData } from "~/types";

const mockPush = vi.fn();
vi.mock("~/shared/hooks/useToast", () => ({ useToast: () => ({ push: mockPush }) }));

const line: CartLineData = {
  product: {
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
  },
  qty: 1,
};

function renderLine() {
  const onSetQty = vi.fn();
  render(
    <CartLine line={line} onInc={vi.fn()} onDec={vi.fn()} onSetQty={onSetQty} onRemove={vi.fn()} />,
  );
  return { input: screen.getByLabelText("Quantity"), onSetQty };
}

describe("CartLine quantity input", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });
  it.each(["0", "-2", "abc", ""])("ignores invalid qty %p", (value) => {
    const { input, onSetQty } = renderLine();
    fireEvent.change(input, { target: { value } });
    expect(onSetQty).not.toHaveBeenCalled();
  });

  it("commits a valid positive integer with the product id", () => {
    const { input, onSetQty } = renderLine();
    fireEvent.change(input, { target: { value: "5" } });
    expect(onSetQty).toHaveBeenCalledWith("p1", 5);
  });
});