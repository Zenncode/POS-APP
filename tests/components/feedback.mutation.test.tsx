import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState, StatCard, Spinner } from "~/shared/components/ui/Feedback";

describe("Feedback — mutation killers", () => {
  describe("EmptyState", () => {
    // Kills: title rendered
    it("renders title", () => {
      render(<EmptyState title="No items found" />);
      expect(screen.getByText("No items found")).toBeInTheDocument();
    });

    // Kills: action rendered when provided
    it("renders action when provided", () => {
      render(<EmptyState title="Empty" action={<button>Add</button>} />);
      expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    });

    // Kills: no action rendered when not provided
    it("does not render action when not provided", () => {
      render(<EmptyState title="Empty" />);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    // Kills: correct classes applied
    it("applies correct container classes", () => {
      render(<EmptyState title="Empty" />);
      const container = screen.getByText("Empty").closest("div");
      expect(container).toHaveClass("flex");
      expect(container).toHaveClass("flex-col");
      expect(container).toHaveClass("items-center");
      expect(container).toHaveClass("justify-center");
    });
  });

  describe("StatCard", () => {
    // Kills: label rendered
    it("renders label", () => {
      render(<StatCard label="Revenue" value="$100" />);
      expect(screen.getByText("Revenue")).toBeInTheDocument();
    });

    // Kills: value rendered with large font
    it("renders value with text-2xl font-semibold", () => {
      render(<StatCard label="Revenue" value="$100" />);
      expect(screen.getByText("$100")).toHaveClass("text-2xl");
      expect(screen.getByText("$100")).toHaveClass("font-semibold");
    });

    // Kills: sub rendered when provided
    it("renders sub when provided", () => {
      render(<StatCard label="Revenue" value="$100" sub="vs last month" />);
      expect(screen.getByText("vs last month")).toBeInTheDocument();
    });

    // Kills: trend up renders up arrow + green + label
    it("renders up trend with green arrow and label", () => {
      render(<StatCard label="Revenue" value="$100" trend="up" trendLabel="+10%" />);
      expect(screen.getByText("↑")).toBeInTheDocument();
      expect(screen.getByText("↑")).toHaveClass("text-[var(--color-success)]");
      expect(screen.getByText("+10%")).toBeInTheDocument();
    });

    // Kills: trend down renders down arrow + red + label
    it("renders down trend with red arrow and label", () => {
      render(<StatCard label="Revenue" value="$100" trend="down" trendLabel="-5%" />);
      expect(screen.getByText("↓")).toBeInTheDocument();
      expect(screen.getByText("↓")).toHaveClass("text-[var(--color-danger)]");
      expect(screen.getByText("-5%")).toBeInTheDocument();
    });

    // Kills: trend neutral renders arrow + muted
    it("renders neutral trend with muted arrow", () => {
      render(<StatCard label="Revenue" value="$100" trend="neutral" />);
      expect(screen.getByText("→")).toBeInTheDocument();
      expect(screen.getByText("→")).toHaveClass("text-[var(--color-text-muted)]");
    });

    // Kills: default trendLabel when not provided
    it("uses default trendLabel when not provided", () => {
      render(<StatCard label="Revenue" value="$100" trend="up" />);
      expect(screen.getByText("+5%")).toBeInTheDocument();
    });

    it("uses default down trendLabel when not provided", () => {
      render(<StatCard label="Revenue" value="$100" trend="down" />);
      expect(screen.getByText("−5%")).toBeInTheDocument();
    });

    it("uses default neutral trendLabel when not provided", () => {
      render(<StatCard label="Revenue" value="$100" trend="neutral" />);
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    // Kills: correct container classes
    it("applies correct container classes", () => {
      render(<StatCard label="Revenue" value="$100" />);
      const container = screen.getByText("Revenue").closest("div");
      expect(container).toHaveClass("rounded-lg");
      expect(container).toHaveClass("border");
      expect(container).toHaveClass("bg-[var(--color-bg)]");
    });
  });

  describe("Spinner", () => {
    // Kills: bare=true renders decorative spinner without role/aria-label
    it("bare=true renders decorative spinner without role=status or aria-label", () => {
      render(<Spinner bare />);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Loading")).not.toBeInTheDocument();
      expect(document.querySelector(".animate-spin")).toHaveAttribute("aria-hidden", "true");
    });

    // Kills: bare=false renders role=status + aria-label=Loading
    it("bare=false renders role=status with aria-label=Loading", () => {
      render(<Spinner />);
      expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    });

    // Kills: className applied when provided (bare=false) - goes to inner spinner
    it("applies className to inner spinner when provided", () => {
      render(<Spinner className="custom-class" />);
      expect(document.querySelector(".animate-spin")).toHaveClass("custom-class");
    });

    // Kills: inline mode when className provided (bare=false) - wrapper has contents display
    it("uses contents display when className provided", () => {
      render(<Spinner className="inline-spinner" />);
      expect(screen.getByRole("status")).toHaveClass("contents");
    });

    // Kills: bare with className uses className on spinner element
    it("bare with className applies className to spinner", () => {
      render(<Spinner bare className="bare-custom" />);
      expect(document.querySelector(".animate-spin")).toHaveClass("bare-custom");
    });
  });
});