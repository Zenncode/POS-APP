import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "~/routes/dashboard";

const mocks = vi.hoisted(() => ({
  getDailyReport: vi.fn(),
  getSummary: vi.fn(),
  push: vi.fn(),
  role: "MANAGER" as string,
  demoMode: false,
}));

vi.mock("~/lib/api", () => ({
  getDailyReport: mocks.getDailyReport,
  getSummary: mocks.getSummary,
}));

vi.mock("~/shared/hooks/useToast", () => ({
  useToast: () => ({ push: mocks.push, toasts: [], remove: vi.fn() }),
}));

vi.mock("~/shared/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u-1", name: "Mina", email: "mina@example.invalid", role: mocks.role },
    loading: false,
    demoMode: mocks.demoMode,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
  roleAtLeast: (role: string | undefined, min: string) => {
    const rank: Record<string, number> = { CASHIER: 1, MANAGER: 2, ADMIN: 3 };
    return (rank[role ?? ""] ?? 0) >= (rank[min] ?? 99);
  },
}));

const REPORT = {
  date: "2026-09-17",
  totalCents: 100000,
  orderCount: 10,
  avgTicketCents: 10000,
  byHour: [{ hour: 9, totalCents: 100000, count: 10 }],
  topProducts: [{ productId: "p-1", name: "Cafe Latte", qty: 5, totalCents: 50000 }],
  lowStock: [],
};

describe("Dashboard Phase 1", () => {
  beforeEach(() => {
    mocks.role = "MANAGER";
    mocks.demoMode = false;
    mocks.push.mockClear();
    mocks.getDailyReport.mockReset();
    mocks.getSummary.mockReset();
    mocks.getDailyReport.mockResolvedValue(REPORT);
    mocks.getSummary.mockResolvedValue({ from: "", to: "", totalCents: 0, orderCount: 0, avgTicketCents: 0 });
  });

  it("denies CASHIER with a one-sentence empty state and skips the API", async () => {
    mocks.role = "CASHIER";
    render(<Dashboard />);
    expect(await screen.findByText(/dashboard is for managers/i)).toBeInTheDocument();
    expect(mocks.getDailyReport).not.toHaveBeenCalled();
  });

  it("shows Retry (not an endless spinner) when the report fails", async () => {
    mocks.getDailyReport.mockRejectedValueOnce(new Error("down"));
    render(<Dashboard />);
    expect(await screen.findByText(/couldn't load the report/i)).toBeInTheDocument();
    expect(mocks.push).toHaveBeenCalledWith("error", "Failed to load report. Try again.");
    // Retry fires the request again
    mocks.getDailyReport.mockResolvedValueOnce(REPORT);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Today's sales")).toBeInTheDocument());
  });

  it("renders summary cards on success", async () => {
    render(<Dashboard />);
    expect(await screen.findByText("Today's sales")).toBeInTheDocument();
    expect(screen.getByText("₱1000.00")).toBeInTheDocument();
  });
});
