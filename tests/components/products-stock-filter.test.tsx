// @vitest/globals fake-top-mocks - move ALL vi.mock calls to absolute top before any import
vi.mock("~/lib/api", () => ({
  getCategories: vi.fn(),
  listProducts: vi.fn(),
  adjustStock: vi.fn(),
  archiveProduct: vi.fn(),
  createProduct: vi.fn(),
  formatCents: () => "₱0.00",
  parseToCents: (s: string) => Number(s),
}));

vi.mock("~/shared/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u-1", name: "Mina", email: "mina@example.invalid", role: "MANAGER" },
    loading: false,
    demoMode: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    roleAtLeast: () => true,
  }),
}));

vi.mock("~/shared/hooks/useToast", () => ({
  useToast: () => ({
    push: vi.fn(),
    toasts: [],
    remove: vi.fn(),
  }),
}));

import { describe, expect, it, vi as viImport } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Products from "~/routes/products";

const SEEDED_PRODUCTS = [
  { id: "p-neg1", sku: "CF-010", name: "Out-of-Stock A", stock: -1, lowStockThreshold: 5 },
  { id: "p-zero", sku: "CF-011", name: "Out-of-Stock B", stock: 0, lowStockThreshold: 5 },
  { id: "p-one", sku: "CF-012", name: "Low Stock Item", stock: 1, lowStockThreshold: 5 },
  { id: "p-thresh", sku: "CF-013", name: "At Threshold", stock: 5, lowStockThreshold: 5 },
  { id: "p-above", sku: "CF-014", name: "Above Threshold", stock: 6, lowStockThreshold: 5 },
  { id: "p-high", sku: "CF-015", name: "Well Stocked", stock: 10, lowStockThreshold: 5 },
];

describe("Products — Stock filter", () => {
  beforeEach(async () => {
    // Reassign resolved mocks to seed specific data per test
    const api = await import("~/lib/api");
    (api.listProducts as any).mockResolvedValueOnce({
      data: SEEDED_PRODUCTS,
      page: 1,
      pageSize: 200,
      total: SEEDED_PRODUCTS.length,
    });
    await render(<Products />);
  });

  it("renders all products when stock filter is 'all' — happy path", async () => {
    await waitFor(() =>
      expect(screen.getByText(/Out-of-Stock A/)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByText(/Out-of-Stock B/)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByText(/Low Stock Item/)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByText(/At Threshold/)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByText(/Above Threshold/)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByText(/Well Stocked/)).toBeInTheDocument()
    );
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(6);
    await waitFor(() =>
      expect(screen.findByText(/6 of 6 loaded products shown/i)).toBeInTheDocument()
    );
  });

  it("renders only low-stock products when stock filter is 'low'", async () => {
    await waitFor(() =>
      screen.getByLabelText(/Low stock/).dispatchEvent("click")
    );
    await waitFor(() =>
      expect(screen.getByText(/Low Stock Item/)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByText(/At Threshold/)).toBeInTheDocument()
    );
    await waitFor(() =>
      !screen.getByText(/Out-of-Stock A/).toBeInTheDocument()
    );
    await waitFor(() =>
      !screen.getByText(/Out-of-Stock B/).toBeInTheDocument()
    );
    await waitFor(() =>
      !screen.getByText(/Above Threshold/).toBeInTheDocument()
    );
    await waitFor(() =>
      !screen.getByText(/Well Stocked/).toBeInTheDocument()
    );
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(2);
    await waitFor(() =>
      expect(screen.findByText(/2 of 6 loaded products shown/i)).toBeInTheDocument()
    );
  });

  it("renders only out-of-stock products when stock filter is 'out'", async () => {
    await waitFor(() =>
      screen.getByLabelText(/Out of stock/).dispatchEvent("click")
    );
    await waitFor(() =>
      expect(screen.getByText(/Out-of-Stock A/)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByText(/Out-of-Stock B/)).toBeInTheDocument()
    );
    await waitFor(() =>
      !screen.getByText(/Low Stock Item/).toBeInTheDocument()
    );
    await waitFor(() =>
      !screen.getByText(/At Threshold/).toBeInTheDocument()
    );
    await waitFor(() =>
      !screen.getByText(/Above Threshold/).toBeInTheDocument()
    );
    await waitFor(() =>
      !screen.getByText(/Well Stocked/).toBeInTheDocument()
    );
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(2);
    await waitFor(() =>
      expect(screen.findByText(/2 of 6 loaded products shown/i)).toBeInTheDocument()
    );
  });

  it("shows correct notice per stock filter — subset notice only when total > data length", async () => {
    await waitFor(() =>
      screen.getByLabelText(/All stock/).dispatchEvent("click")
    );
    await waitFor(() =>
      expect(screen.findByText(/6 of 6 loaded products shown/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/No products match your search or category./i)).not.toBeInTheDocument();

    await waitFor(() =>
      screen.getByLabelText(/Low stock/).dispatchEvent("click")
    );
    await waitFor(() =>
      expect(screen.findByText(/2 of 6 loaded products shown/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/No loaded products match this stock filter/i)).not.toBeInTheDocument();
  });

  it("applies search query AND stock filter together (intersection)", async () => {
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/Search SKU, name, barcode/i);
      fireEvent.change(searchInput, { target: { value: "Out-of-Stock" } });
    });
    await waitFor(() =>
      expect(screen.getByText(/Out-of-Stock A/)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.queryByText(/Out-of-Stock B/)).not.toBeInTheDocument()
    );
    await waitFor(() =>
      screen.getByLabelText(/Low stock/).dispatchEvent("click")
    );
    await waitFor(() =>
      expect(screen.getByText(/Low Stock Item/)).toBeInTheDocument()
    );
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(1);
    await waitFor(() =>
      expect(screen.findByText(/1 of 6 loaded products shown/i)).toBeInTheDocument()
    );
  });
});