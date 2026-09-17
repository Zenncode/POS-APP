import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "~/shared/components/ui/Input";

describe("Input", () => {
  it("joins error and hint ids in aria-describedby when both are present", () => {
    render(<Input id="name" label="Name" error="Too short" hint="At least 3 chars" />);
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-describedby",
      "name-error name-hint",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Too short");
  });

  it("label + required renders a visual asterisk and the required attribute", () => {
    render(<Input label="Name" required />);
    expect(screen.getByRole("textbox")).toHaveAttribute("required");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("leftIcon renders the icon and applies pl-10 to the input", () => {
    render(<Input label="Search" leftIcon={<span data-testid="icon">Q</span>} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveClass("pl-10");
  });

  it("passwordToggle renders Show password button with type=password initially", () => {
    render(<Input label="Password" type="password" passwordToggle />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("click toggles to text + Hide password then back", () => {
    render(<Input label="Password" type="password" passwordToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("toggle wins over rightIcon", () => {
    render(
      <Input
        label="Password"
        type="password"
        passwordToggle
        rightIcon={<span data-testid="right-icon">R</span>}
      />,
    );
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
    expect(screen.queryByTestId("right-icon")).not.toBeInTheDocument();
  });

  it("no toggle button when passwordToggle off", () => {
    render(<Input label="Password" type="password" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.queryByRole("button", { name: /password/i })).not.toBeInTheDocument();
  });
});
