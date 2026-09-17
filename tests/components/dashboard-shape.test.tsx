import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "~/routes/dashboard";

const mocks = vi.hoisted(() => ({
  getDailyReport: vi.fn(),
  getSummary: vi.fn(),
  push: vi.fn(),
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
    user: { id: "u-1", name: "Mina", email: "mina@example.invalid", role: "MANAGER" },
    loading: false,
    demoMode: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
  roleAtLeast: () => true,
}));

describe("Dashboard shape drift (dashboard.tsx:80)", () => {
  beforeEach(() => {
    mocks.push.mockClear();
    mocks.getDailyReport.mockReset();
    mocks.getSummary.mockReset();
    mocks.getSummary.mockResolvedValue({ from: "", to: "", totalCents: 0, orderCount: 0, avgTicketCents: 0 });
  });

  it("renders zeros without throwing when live report omits array fields", async () => {
    // Fresh DB / API shape drift: scalars present, arrays undefined
    mocks.getDailyReport.mockResolvedValue({
      date: "2026-09-17",
      totalCents: 0,
      orderCount: 0,
      avgTicketCents: 0,
      byHour: undefined,
      topProducts: undefined,
      lowStock: undefined,
    });
    render(<Dashboard />);
    expect(await screen.findByText("Today's sales")).toBeInTheDocument();
    expect(screen.getByText("All stocked. Nice.")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
