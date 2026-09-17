import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "~/shared/components/ui/Select";

describe("Select — mutation killers", () => {
  // Kills: empty options renders only placeholder
  it("renders only placeholder when options is empty", () => {
    render(<Select label="Category" value="" onChange={vi.fn()} options={[]} placeholder="Pick one" />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Pick one");
  });

  // Kills: error renders role=alert + aria-describedby + aria-invalid
  it("error renders role=alert and wires aria-describedby + aria-invalid", () => {
    render(
      <Select id="cat" label="Category" value="" onChange={vi.fn()} options={[]} error="Category is required" />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Category is required");
    const select = screen.getByRole("combobox");
    expect(select).toHaveAttribute("aria-describedby", "cat-error");
    expect(select).toHaveAttribute("aria-invalid", "true");
  });

  // Kills: hint renders when no error
  it("hint renders when no error", () => {
    render(
      <Select id="cat" label="Category" value="" onChange={vi.fn()} options={[]} hint="Select a category" />
    );
    expect(screen.getByText("Select a category")).toBeInTheDocument();
    const select = screen.getByRole("combobox");
    expect(select).toHaveAttribute("aria-describedby", "cat-hint");
  });

  // Kills: onChange receives raw string value
  it("onChange receives the raw string value", () => {
    const onChange = vi.fn();
    render(
      <Select label="Category" value="" onChange={onChange} options={[{ value: "drinks", label: "Drinks" }]} />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "drinks" } });
    expect(onChange).toHaveBeenCalledWith("drinks");
  });

  // Kills: disabled option not selectable (native select still fires change but value is the disabled option value)
  it("disabled option has disabled attribute", () => {
    render(
      <Select label="Category" value="" onChange={vi.fn()} options={[{ value: "drinks", label: "Drinks", disabled: true }]} />
    );
    const option = screen.getByRole("option", { name: "Drinks" });
    expect(option).toBeDisabled();
  });

  // Kills: required attribute on select
  it("required attribute when required=true", () => {
    render(<Select label="Category" value="" onChange={vi.fn()} options={[]} required />);
    expect(screen.getByRole("combobox")).toHaveAttribute("required");
  });

  // Kills: label renders with asterisk when required
  it("label renders asterisk when required", () => {
    render(<Select label="Category" value="" onChange={vi.fn()} options={[]} required />);
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  // Kills: placeholder option value is empty string
  it("placeholder option has empty value", () => {
    render(<Select label="Category" value="" onChange={vi.fn()} options={[{ value: "a", label: "A" }]} placeholder="Pick" />);
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("value", "");
  });

  // Kills: id generation from label when no explicit id
  it("generates id from label when no explicit id", () => {
    render(<Select label="User Role" value="" onChange={vi.fn()} options={[]} />);
    expect(screen.getByRole("combobox")).toHaveAttribute("id", expect.stringMatching(/^sel-user-role-/));
  });
});