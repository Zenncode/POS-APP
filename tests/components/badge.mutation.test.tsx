import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "~/shared/components/ui/Badge";

describe("Badge — mutation killers", () => {
  // Kills: tone mapping to correct dot color - the dot is first child span
  it("renders emerald dot for PAID tone", () => {
    render(<Badge tone="PAID">Paid</Badge>);
    const badge = screen.getByText("Paid").closest("span");
    const dot = badge?.firstElementChild;
    expect(dot).toHaveClass("bg-emerald-600");
  });

  it("renders amber dot for PENDING tone", () => {
    render(<Badge tone="PENDING">Pending</Badge>);
    const badge = screen.getByText("Pending").closest("span");
    const dot = badge?.firstElementChild;
    expect(dot).toHaveClass("bg-amber-500");
  });

  it("renders gray dot for VOID tone", () => {
    render(<Badge tone="VOID">Void</Badge>);
    const badge = screen.getByText("Void").closest("span");
    const dot = badge?.firstElementChild;
    expect(dot).toHaveClass("bg-gray-400");
  });

  it("renders gray dot for REFUNDED tone", () => {
    render(<Badge tone="REFUNDED">Refunded</Badge>);
    const badge = screen.getByText("Refunded").closest("span");
    const dot = badge?.firstElementChild;
    expect(dot).toHaveClass("bg-gray-500");
  });

  it("renders red dot for LOW tone", () => {
    render(<Badge tone="LOW">Low</Badge>);
    const badge = screen.getByText("Low").closest("span");
    const dot = badge?.firstElementChild;
    expect(dot).toHaveClass("bg-red-600");
  });

  it("renders emerald dot for OK tone", () => {
    render(<Badge tone="OK">OK</Badge>);
    const badge = screen.getByText("OK").closest("span");
    const dot = badge?.firstElementChild;
    expect(dot).toHaveClass("bg-emerald-600");
  });

  it("renders gray dot for MUTED tone", () => {
    render(<Badge tone="MUTED">Muted</Badge>);
    const badge = screen.getByText("Muted").closest("span");
    const dot = badge?.firstElementChild;
    expect(dot).toHaveClass("bg-gray-400");
  });

  it("renders emerald dot for CASH tone", () => {
    render(<Badge tone="CASH">Cash</Badge>);
    const badge = screen.getByText("Cash").closest("span");
    const dot = badge?.firstElementChild;
    expect(dot).toHaveClass("bg-emerald-600");
  });

  it("renders gray dot for CARD tone", () => {
    render(<Badge tone="CARD">Card</Badge>);
    const badge = screen.getByText("Card").closest("span");
    const dot = badge?.firstElementChild;
    expect(dot).toHaveClass("bg-gray-500");
  });

  it("renders gray dot for QR tone", () => {
    render(<Badge tone="QR">QR</Badge>);
    const badge = screen.getByText("QR").closest("span");
    const dot = badge?.firstElementChild;
    expect(dot).toHaveClass("bg-gray-500");
  });

  it("renders gray dot for WALLET tone", () => {
    render(<Badge tone="WALLET">Wallet</Badge>);
    const badge = screen.getByText("Wallet").closest("span");
    const dot = badge?.firstElementChild;
    expect(dot).toHaveClass("bg-gray-500");
  });

  // Kills: unknown tone falls back to MUTED
  it("falls back to MUTED dot for unknown tone", () => {
    render(<Badge tone="UNKNOWN">Unknown</Badge>);
    const badge = screen.getByText("Unknown").closest("span");
    const dot = badge?.firstElementChild;
    expect(dot).toHaveClass("bg-gray-400");
  });

  // Kills: children rendered
  it("renders children content", () => {
    render(<Badge tone="PAID">Custom Label</Badge>);
    expect(screen.getByText("Custom Label")).toBeInTheDocument();
  });

  // Kills: dot has aria-hidden
  it("dot has aria-hidden=true", () => {
    render(<Badge tone="PAID">Paid</Badge>);
    const badge = screen.getByText("Paid").closest("span");
    const dot = badge?.firstElementChild as HTMLElement;
    expect(dot).toHaveAttribute("aria-hidden", "true");
  });

  // Kills: dot has size-1.5 shrink-0 rounded-full classes
  it("dot has correct size classes", () => {
    render(<Badge tone="PAID">Paid</Badge>);
    const badge = screen.getByText("Paid").closest("span");
    const dot = badge?.firstElementChild as HTMLElement;
    expect(dot).toHaveClass("size-1.5");
    expect(dot).toHaveClass("shrink-0");
    expect(dot).toHaveClass("rounded-full");
  });
});