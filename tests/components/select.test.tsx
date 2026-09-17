import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "~/shared/components/ui/Select";

describe("Select", () => {
  it("renders only the placeholder when options is empty", () => {
    render(
      <Select label="Category" value="" onChange={vi.fn()} options={[]} placeholder="Pick one" />,
    );
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Pick one");
  });

  it("error renders role=alert and wires aria-describedby + aria-invalid", () => {
    render(
      <Select
        id="cat"
        label="Category"
        value=""
        onChange={vi.fn()}
        options={[]}
        error="Category is required"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Category is required");
    const select = screen.getByRole("combobox");
    expect(select).toHaveAttribute("aria-describedby", "cat-error");
    expect(select).toHaveAttribute("aria-invalid", "true");
  });

  it("onChange receives the raw string value", () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Category"
        value=""
        onChange={onChange}
        options={[{ value: "drinks", label: "Drinks" }]}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "drinks" } });
    expect(onChange).toHaveBeenCalledWith("drinks");
  });
});
