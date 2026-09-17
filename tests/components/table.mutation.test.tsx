import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Table } from "~/shared/components/ui/Table";

interface Row { id: string; name: string; value: number; }
const columns = [
  { key: "name", header: "Name", render: (r: Row) => r.name },
  { key: "value", header: "Value", render: (r: Row) => r.value, align: "right" as const, sortable: true },
];
const data: Row[] = [
  { id: "1", name: "A", value: 10 },
  { id: "2", name: "B", value: 20 },
];

describe("Table — mutation killers", () => {
  // Kills: renders headers with sortable button when sortable+onSort
  it("renders sortable header button when sortable and onSort provided", () => {
    const onSort = vi.fn();
    render(<Table<Row> columns={columns} data={data} rowKey={r => r.id} onSort={onSort} />);
    expect(screen.getByRole("button", { name: "Value" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Name" })).not.toBeInTheDocument();
  });

  // Kills: sort indicator shows asc/desc
  it("shows asc indicator when sortBy matches and sortDir=asc", () => {
    render(<Table<Row> columns={columns} data={data} rowKey={r => r.id} sortBy="value" sortDir="asc" onSort={vi.fn()} />);
    expect(screen.getByText("↑")).toBeInTheDocument();
  });

  it("shows desc indicator when sortBy matches and sortDir=desc", () => {
    render(<Table<Row> columns={columns} data={data} rowKey={r => r.id} sortBy="value" sortDir="desc" onSort={vi.fn()} />);
    expect(screen.getByText("↓")).toBeInTheDocument();
  });

  // Kills: onSort called with correct key
  it("calls onSort with column key when header clicked", () => {
    const onSort = vi.fn();
    render(<Table<Row> columns={columns} data={data} rowKey={r => r.id} onSort={onSort} />);
    fireEvent.click(screen.getByRole("button", { name: "Value" }));
    expect(onSort).toHaveBeenCalledWith("value");
  });

  // Kills: loading state renders spinner
  it("renders loading spinner when loading=true", () => {
    render(<Table<Row> columns={columns} data={[]} rowKey={r => r.id} loading />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.getByText("Loading…").closest("td")?.querySelector(".animate-spin")).toBeInTheDocument();
  });

  // Kills: empty state renders emptyMessage
  it("renders emptyMessage when data empty and not loading", () => {
    render(<Table<Row> columns={columns} data={[]} rowKey={r => r.id} emptyMessage="No items" />);
    expect(screen.getByText("No items")).toBeInTheDocument();
  });

  // Kills: default emptyMessage when not provided
  it("renders default emptyMessage when not provided", () => {
    render(<Table<Row> columns={columns} data={[]} rowKey={r => r.id} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  // Kills: row click calls onRowClick
  it("calls onRowClick with row data when row clicked", () => {
    const onRowClick = vi.fn();
    render(<Table<Row> columns={columns} data={data} rowKey={r => r.id} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("A"));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  // Kills: Enter key on row calls onRowClick
  it("calls onRowClick on Enter key when row focused", () => {
    const onRowClick = vi.fn();
    render(<Table<Row> columns={columns} data={data} rowKey={r => r.id} onRowClick={onRowClick} />);
    const row = screen.getByText("A").closest("tr");
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  // Kills: pagination renders when total > pageSize
  it("renders pagination when total > pageSize", () => {
    render(<Table<Row> columns={columns} data={data} rowKey={r => r.id} total={50} pageSize={10} onPageChange={vi.fn()} />);
    expect(screen.getByText("Showing 1–10 of 50")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prev" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  // Kills: Prev disabled on page 1
  it("Prev button disabled on page 1", () => {
    render(<Table<Row> columns={columns} data={data} rowKey={r => r.id} total={50} page={1} pageSize={10} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
  });

  // Kills: Next disabled on last page
  it("Next button disabled on last page", () => {
    render(<Table<Row> columns={columns} data={data} rowKey={r => r.id} total={50} page={5} pageSize={10} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  // Kills: onPageChange called with correct page
  it("onPageChange called with page-1 for Prev", () => {
    const onPageChange = vi.fn();
    render(<Table<Row> columns={columns} data={data} rowKey={r => r.id} total={50} page={2} pageSize={10} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Prev" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  // Kills: column align right/center classes
  it("applies text-right class for align=right", () => {
    render(<Table<Row> columns={columns} data={data} rowKey={r => r.id} />);
    expect(screen.getByText("10").closest("td")).toHaveClass("text-right");
  });

  it("applies text-center class for align=center", () => {
    const cols = [{ key: "name", header: "Name", render: (r: Row) => r.name, align: "center" as const }];
    render(<Table<Row> columns={cols} data={data} rowKey={r => r.id} />);
    expect(screen.getByText("A").closest("td")).toHaveClass("text-center");
  });

  // Kills: column width style
  it("applies width style when column has width", () => {
    const cols = [{ key: "name", header: "Name", render: (r: Row) => r.name, width: "200px" }];
    render(<Table<Row> columns={cols} data={data} rowKey={r => r.id} />);
    const th = screen.getByText("Name").closest("th");
    expect(th).toHaveStyle({ width: "200px" });
  });

  // Kills: totalPages calculation
  it("calculates totalPages correctly", () => {
    render(<Table<Row> columns={columns} data={data} rowKey={r => r.id} total={25} pageSize={10} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled(); // page 1 of 3
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled(); // page 2 of 3
  });
});