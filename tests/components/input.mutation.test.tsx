import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "~/shared/components/ui/Input";

describe("Input — mutation killers", () => {
  // Kills: error + hint both present -> aria-describedby joins both ids
  it("joins error and hint ids in aria-describedby when both present", () => {
    render(<Input id="name" label="Name" error="Too short" hint="At least 3 chars" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-describedby", "name-error name-hint");
    expect(screen.getByRole("alert")).toHaveTextContent("Too short");
  });

  // Kills: error only -> aria-describedby only error id
  it("aria-describedby only error id when only error present", () => {
    render(<Input id="email" label="Email" error="Invalid" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-describedby", "email-error");
    expect(screen.queryByRole("alert")).toHaveTextContent("Invalid");
  });

  // Kills: hint only -> aria-describedby only hint id
  it("aria-describedby only hint id when only hint present", () => {
    render(<Input id="search" label="Search" hint="Type to search" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-describedby", "search-hint");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // Kills: neither error nor hint -> no aria-describedby
  it("no aria-describedby when neither error nor hint", () => {
    render(<Input id="clean" label="Clean" />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-describedby");
  });

  // Kills: required attribute + asterisk
  it("required attribute and visual asterisk when required=true", () => {
    render(<Input label="Name" required />);
    expect(screen.getByRole("textbox")).toHaveAttribute("required");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  // Kills: leftIcon renders and applies pl-10
  it("leftIcon renders and applies pl-10", () => {
    render(<Input label="Search" leftIcon={<span data-testid="icon">Q</span>} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveClass("pl-10");
  });

  // Kills: rightIcon renders and applies pr-10
  it("rightIcon renders and applies pr-10", () => {
    render(<Input label="Amount" rightIcon={<span data-testid="icon">$</span>} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveClass("pr-10");
  });

  // Kills: aria-invalid=true when error present
  it("aria-invalid=true when error present", () => {
    render(<Input label="Name" error="Required" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  // Kills: aria-invalid=false when no error
  it("aria-invalid=false when no error", () => {
    render(<Input label="Name" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "false");
  });

  // Kills: id generation from label when no explicit id
  it("generates id from label when no explicit id", () => {
    render(<Input label="User Name" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("id", expect.stringMatching(/^in-user-name-/));
  });
});