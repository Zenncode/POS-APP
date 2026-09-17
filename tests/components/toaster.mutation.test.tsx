import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Toaster } from "~/shared/components/ui/Toaster";

const mockRemove = vi.fn();

vi.mock("~/shared/hooks/useToast", () => ({
  useToast: () => ({
    toasts: [
      { id: "1", type: "success" as const, message: "Success!" },
      { id: "2", type: "error" as const, message: "Error!" },
      { id: "3", type: "info" as const, message: "Info!" },
    ],
    remove: mockRemove,
  }),
}));

describe("Toaster — mutation killers", () => {
  beforeEach(() => mockRemove.mockClear());

  // Kills: renders toasts from context
  it("renders toasts from useToast context", () => {
    render(<Toaster />);
    expect(screen.getByText("Success!")).toBeInTheDocument();
    expect(screen.getByText("Error!")).toBeInTheDocument();
    expect(screen.getByText("Info!")).toBeInTheDocument();
  });

  // Kills: success toast has success border
  it("success toast has success border class", () => {
    render(<Toaster />);
    const toast = screen.getByText("Success!").closest("div");
    expect(toast).toHaveClass("border-[var(--color-success-soft)]");
  });

  // Kills: error toast has danger border
  it("error toast has danger border class", () => {
    render(<Toaster />);
    const toast = screen.getByText("Error!").closest("div");
    expect(toast).toHaveClass("border-[var(--color-danger-soft)]");
  });

  // Kills: info toast has info border (default)
  it("info toast has info border class", () => {
    render(<Toaster />);
    const toast = screen.getByText("Info!").closest("div");
    expect(toast).toHaveClass("border-[var(--color-info-soft)]");
  });

  // Kills: dismiss button calls remove with toast id (click first dismiss button)
  it("dismiss button calls remove with toast id", () => {
    render(<Toaster />);
    fireEvent.click(screen.getAllByLabelText("Dismiss")[0]);
    expect(mockRemove).toHaveBeenCalledWith("1");
  });

  // Kills: role=region + aria-live=polite on container
  it("container has role=region and aria-live=polite", () => {
    render(<Toaster />);
    const container = screen.getByLabelText("Notifications");
    expect(container).toHaveAttribute("role", "region");
    expect(container).toHaveAttribute("aria-live", "polite");
  });

  // Kills: each toast has role=alert
  it("each toast has role=alert", () => {
    render(<Toaster />);
    expect(screen.getAllByRole("alert")).toHaveLength(3);
  });

  // Kills: container has correct positioning classes
  it("container has fixed top-4 right-4 positioning", () => {
    render(<Toaster />);
    const container = screen.getByLabelText("Notifications");
    expect(container).toHaveClass("fixed");
    expect(container).toHaveClass("top-4");
    expect(container).toHaveClass("right-4");
    expect(container).toHaveClass("z-[var(--z-toast)]");
  });
});