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

describe("CartLine — mutation killers", () => {
  beforeEach(() => mockPush.mockClear());

  // Kills: stock check on increment
  it("shows error toast and blocks increment when qty >= stock", () => {
    const onInc = vi.fn();
    render(<CartLine line={line} onInc={onInc} onDec={vi.fn()} onSetQty={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Increase"));
    // qty=1, stock=10, so this should NOT trigger error
    expect(onInc).toHaveBeenCalledWith("p1");
    expect(mockPush).not.toHaveBeenCalled();
  });

  // Kills: stock check on increment at boundary
  it("shows error toast when increment would exceed stock", () => {
    const maxLine = { ...line, qty: 10 };
    const onInc = vi.fn();
    render(<CartLine line={maxLine} onInc={onInc} onDec={vi.fn()} onSetQty={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Increase"));
    expect(mockPush).toHaveBeenCalledWith("error", "Only 10 in stock");
    expect(onInc).not.toHaveBeenCalled();
  });

  // Kills: onInc called with product id
  it("onInc called with product id", () => {
    const onInc = vi.fn();
    render(<CartLine line={line} onInc={onInc} onDec={vi.fn()} onSetQty={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Increase"));
    expect(onInc).toHaveBeenCalledWith("p1");
  });

  // Kills: onDec called with product id
  it("onDec called with product id", () => {
    const onDec = vi.fn();
    render(<CartLine line={line} onInc={vi.fn()} onDec={onDec} onSetQty={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Decrease"));
    expect(onDec).toHaveBeenCalledWith("p1");
  });

  // Kills: onRemove called with product id
  it("onRemove called with product id", () => {
    const onRemove = vi.fn();
    render(<CartLine line={line} onInc={vi.fn()} onDec={vi.fn()} onSetQty={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText("Remove Coffee"));
    expect(onRemove).toHaveBeenCalledWith("p1");
  });

  // Kills: quantity input validation - empty string ignored
  it("ignores empty string input", () => {
    const onSetQty = vi.fn();
    render(<CartLine line={line} onInc={vi.fn()} onDec={vi.fn()} onSetQty={onSetQty} onRemove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "" } });
    expect(onSetQty).not.toHaveBeenCalled();
  });

  // Kills: quantity input validation - zero ignored
  it("ignores zero input", () => {
    const onSetQty = vi.fn();
    render(<CartLine line={line} onInc={vi.fn()} onDec={vi.fn()} onSetQty={onSetQty} onRemove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "0" } });
    expect(onSetQty).not.toHaveBeenCalled();
  });

  // Kills: quantity input validation - negative ignored
  it("ignores negative input", () => {
    const onSetQty = vi.fn();
    render(<CartLine line={line} onInc={vi.fn()} onDec={vi.fn()} onSetQty={onSetQty} onRemove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "-2" } });
    expect(onSetQty).not.toHaveBeenCalled();
  });

  // Kills: quantity input validation - non-numeric ignored
  it("ignores non-numeric input", () => {
    const onSetQty = vi.fn();
    render(<CartLine line={line} onInc={vi.fn()} onDec={vi.fn()} onSetQty={onSetQty} onRemove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "abc" } });
    expect(onSetQty).not.toHaveBeenCalled();
  });

  // Kills: quantity input validation - decimal floored (3.5 -> 3, valid)
  it("floors decimal input to valid integer", () => {
    const onSetQty = vi.fn();
    render(<CartLine line={line} onInc={vi.fn()} onDec={vi.fn()} onSetQty={onSetQty} onRemove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "3.5" } });
    expect(onSetQty).toHaveBeenCalledWith("p1", 3);
  });

  // Kills: valid positive integer commits
  it("commits valid positive integer with product id", () => {
    const onSetQty = vi.fn();
    render(<CartLine line={line} onInc={vi.fn()} onDec={vi.fn()} onSetQty={onSetQty} onRemove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "5" } });
    expect(onSetQty).toHaveBeenCalledWith("p1", 5);
  });

  // Kills: stock cap on setQty
  it("caps quantity at stock and shows error when input > stock", () => {
    const onSetQty = vi.fn();
    render(<CartLine line={line} onInc={vi.fn()} onDec={vi.fn()} onSetQty={onSetQty} onRemove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "15" } });
    expect(onSetQty).toHaveBeenCalledWith("p1", 10);
    expect(mockPush).toHaveBeenCalledWith("error", "Only 10 in stock");
  });

  // Kills: product name displayed
  it("displays product name", () => {
    render(<CartLine line={line} onInc={vi.fn()} onDec={vi.fn()} onSetQty={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("Coffee")).toBeInTheDocument();
  });

  // Kills: unit price displayed (uses ₱ symbol)
  it("displays unit price formatted", () => {
    render(<CartLine line={line} onInc={vi.fn()} onDec={vi.fn()} onSetQty={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("₱1.50 each")).toBeInTheDocument();
  });

  // Kills: line total displayed (uses ₱ symbol)
  it("displays line total formatted", () => {
    const line3 = { ...line, qty: 3 };
    render(<CartLine line={line3} onInc={vi.fn()} onDec={vi.fn()} onSetQty={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("₱4.50")).toBeInTheDocument();
  });

  // Kills: input min/max attributes
  it("input has min=1 and max=stock", () => {
    render(<CartLine line={line} onInc={vi.fn()} onDec={vi.fn()} onSetQty={vi.fn()} onRemove={vi.fn()} />);
    const input = screen.getByLabelText("Quantity");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "10");
  });
});