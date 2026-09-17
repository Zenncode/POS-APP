import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StaffManagement from "~/routes/staff-management";
import type { StaffUser } from "~/types";

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  resetUserPassword: vi.fn(),
  fetchMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  push: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  listUsers: mocks.listUsers,
  createUser: mocks.createUser,
  updateUser: mocks.updateUser,
  deleteUser: mocks.deleteUser,
  resetUserPassword: mocks.resetUserPassword,
  fetchMe: mocks.fetchMe,
  login: mocks.login,
  logout: mocks.logout,
}));

vi.mock("~/shared/hooks/useToast", () => ({
  useToast: () => ({ push: mocks.push }),
}));

// roleAtLeast stays REAL (spread of importOriginal) so the ADMIN gating that
// shows the "+ Add User" / Edit buttons is genuinely exercised, not mocked away.
vi.mock("~/shared/hooks/useAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/shared/hooks/useAuth")>();
  return {
    ...actual,
    useAuth: () => ({
      user: ADMIN,
      loading: false,
      demoMode: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    }),
  };
});

const ADMIN: StaffUser = {
  id: "u-1",
  email: "admin.test@example.invalid",
  name: "Adm",
  role: "ADMIN",
  storeId: null,
  isActive: true,
};

const BOB: StaffUser = {
  id: "u-2",
  email: "bob.test@example.invalid",
  name: "Bob Jones",
  role: "CASHIER",
  storeId: null,
  isActive: true,
};

async function renderStaff(): Promise<void> {
  await act(async () => {
    render(<StaffManagement />);
  });
}

async function openAddModal(): Promise<HTMLElement> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "+ Add User" }));
  });
  return screen.getByRole("dialog", { name: "Add User" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listUsers.mockResolvedValue({ users: [BOB], page: 1, pageSize: 20, total: 1 });
  mocks.createUser.mockResolvedValue(BOB);
  mocks.updateUser.mockResolvedValue(BOB);
});

describe("Staff Management — Add/Edit User modal", () => {
  it("opens the Add modal with an empty draft: blank name/PIN, CASHIER role, Active checked", async () => {
    await renderStaff();
    const dialog = await openAddModal();

    const name = within(dialog).getByLabelText("Name") as HTMLInputElement;
    // the Input nests its hint span inside the <label>, so the accessible name
    // is "PIN" + hint text — match by prefix.
    const pin = within(dialog).getByLabelText(/^PIN/) as HTMLInputElement;
    const role = within(dialog).getByLabelText("Role") as HTMLSelectElement;
    const active = within(dialog).getByLabelText("Active") as HTMLInputElement;

    expect(name.value).toBe("");
    expect(pin.value).toBe("");
    expect(role.value).toBe("CASHIER");
    expect(active.checked).toBe(true);
  });

  it("blocks save on a blank name: error toast, no createUser call, dialog stays open", async () => {
    await renderStaff();
    const dialog = await openAddModal();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Create user" }));
    });

    expect(mocks.push).toHaveBeenCalledWith("error", "Name is required.");
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Add User" })).toBeInTheDocument();
  });

  it("sends the TRIMMED name on create", async () => {
    await renderStaff();
    const dialog = await openAddModal();

    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "  Ada Lee  " } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Create user" }));
    });

    expect(mocks.createUser).toHaveBeenCalledTimes(1);
    expect(mocks.createUser.mock.calls[0][0]).toEqual({ name: "Ada Lee", role: "CASHIER", pin: undefined });
  });

  it("Edit prefills name with blank PIN; save sends pin: undefined (never an empty string)", async () => {
    await renderStaff();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    });
    const dialog = screen.getByRole("dialog", { name: "Edit User" });

    expect((within(dialog).getByLabelText("Name") as HTMLInputElement).value).toBe("Bob Jones");
    expect((within(dialog).getByLabelText(/^PIN/) as HTMLInputElement).value).toBe("");

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    });

    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser).toHaveBeenCalledWith("u-2", {
      name: "Bob Jones",
      role: "CASHIER",
      isActive: true,
      pin: undefined,
    });
    const payload = mocks.updateUser.mock.calls[0][1] as Record<string, unknown>;
    expect("pin" in payload).toBe(true);
    expect(payload.pin).toBeUndefined();
  });

  it("role change updates the draft and reaches the create payload", async () => {
    await renderStaff();
    const dialog = await openAddModal();

    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Zoe" } });
    const role = within(dialog).getByLabelText("Role") as HTMLSelectElement;
    fireEvent.change(role, { target: { value: "MANAGER" } });
    expect(role.value).toBe("MANAGER");

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Create user" }));
    });

    expect(mocks.createUser).toHaveBeenCalledTimes(1);
    expect(mocks.createUser.mock.calls[0][0]).toEqual({ name: "Zoe", role: "MANAGER", pin: undefined });
  });
});
