import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "~/shared/components/ui/Button";
import { Spinner } from "~/shared/components/ui/Feedback";

function childOrder(btn: HTMLElement): string[] {
  const icon = screen.queryByTestId("icon");
  return Array.from(btn.childNodes).map((n) => {
    if (n.nodeType === Node.TEXT_NODE) return `text:${n.textContent?.trim()}`;
    if (icon && (n as HTMLElement).contains(icon)) return "icon";
    return `el:${(n as HTMLElement).tagName.toLowerCase()}`;
  });
}

describe("Button", () => {
  it("loading disables the button, sets aria-busy, suppresses the icon, keeps the spinner decorative", () => {
    render(
      <Button loading icon={<span data-testid="icon">@</span>}>
        Save
      </Button>,
    );
    // The inline spinner must NOT pollute the accessible name (N1):
    // exact name "Save", ring present, no role=status / aria-label=Loading inside.
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("icon")).toBeNull();
    expect(btn.querySelector(".animate-spin")).not.toBeNull();
    expect(btn.querySelector('[role="status"]')).toBeNull();
    expect(btn.querySelector('[aria-label="Loading"]')).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(childOrder(btn)).toEqual(["el:div", "text:Save"]);
  });

  it("standalone block Spinner keeps role=status + aria-label (unchanged default)", () => {
    render(<Spinner />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders the icon before the children by default (left)", () => {
    render(<Button icon={<span data-testid="icon">@</span>}>Go</Button>);
    expect(childOrder(screen.getByRole("button", { name: "Go" }))).toEqual([
      "icon",
      "text:Go",
    ]);
  });

  it("iconPosition=right renders the icon after the children", () => {
    render(
      <Button icon={<span data-testid="icon">@</span>} iconPosition="right">
        Go
      </Button>,
    );
    expect(childOrder(screen.getByRole("button", { name: "Go" }))).toEqual([
      "text:Go",
      "icon",
    ]);
  });
});
