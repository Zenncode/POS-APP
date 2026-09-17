import { useState, useEffect } from "react";
import type { JSX } from "react";
import { listUsers, createUser, updateUser, deleteUser, resetUserPassword } from "~/lib/api";
import { useAuth, roleAtLeast } from "~/shared/hooks/useAuth";
import { useToast } from "~/shared/hooks/useToast";
import { Button } from "~/shared/components/ui/Button";
import { Badge } from "~/shared/components/ui/Badge";
import { EmptyState, Spinner } from "~/shared/components/ui/Feedback";
import { Input } from "~/shared/components/ui/Input";
import { Modal } from "~/shared/components/ui/Modal";
import { Select } from "~/shared/components/ui/Select";
import { Table } from "~/shared/components/ui/Table";
import type { Column } from "~/shared/components/ui/Table";
import { Navigate } from "react-router";
import type { StaffUser as StaffUserType } from "~/types";

export function meta(): { title: string }[] {
  return [{ title: "Staff Management — Point of Sale" }];
}

function canManageUsers(role: StaffUserType["role"] | undefined): boolean {
  return roleAtLeast(role, "ADMIN");
}

export default function StaffManagement(): JSX.Element {
  const { user, loading: authLoading } = useAuth();
  const { push } = useToast();

  const role = user?.role;
  const allowed = canManageUsers(role);

  const [users, setUsers] = useState<StaffUserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<StaffUserType | null>(null);
  const [form, setForm] = useState({ name: "", role: "CASHIER" as StaffUserType["role"], pin: "", isActive: true });
  const [formOpen, setFormOpen] = useState(false);

  // Load users
  async function loadUsers(): Promise<void> {
    setLoading(true);
    try {
      const { users: listedUsers } = await listUsers();
      setUsers(listedUsers);
    } catch {
      push("error", "Failed to load users. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Load users — only when allowed; toast once via effect (never during render,
  // otherwise ToastProvider setState re-renders us into an infinite loop).
  useEffect(() => {
    if (!authLoading && !allowed) push("error", "Admin access required.");
  }, [authLoading, allowed, push]);

  useEffect(() => {
    if (!allowed) return;
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [push, allowed]);

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!allowed) return <Navigate to="/register" replace />;

  // Reset form
  const resetForm = (): void => {
    setForm({ name: "", role: "CASHIER" as StaffUserType["role"], pin: "", isActive: true });
  };

  // Handle role change in form
  const onRoleChange = (role: string): void => {
    setForm({ ...form, role: role as StaffUserType["role"] });
  };

  // Open add user modal
  const openAddModal = (): void => {
    resetForm();
    setEditing(false);
    setFormOpen(true);
  };

  // Open edit modal
  const openEditModal = (u: StaffUserType): void => {
    setCurrentUser(u);
    setForm({
      name: u.name,
      role: u.role,
      pin: "", // PIN not shown for security; admin sets it
      isActive: u.isActive,
    });
    setEditing(true);
    setFormOpen(true);
  };

  // Close modals
  const closeModals = (): void => {
    setEditing(false);
    setCurrentUser(null);
    resetForm();
    setFormOpen(false);
  };

  // Save user (add or edit)
  const saveUser = async (): Promise<void> => {
    if (!form.name.trim()) {
      push("error", "Name is required.");
      return;
    }
    if (form.role !== "ADMIN" && form.role !== "MANAGER" && form.role !== "CASHIER") {
      push("error", "Invalid role.");
      return;
    }
    if (form.role === "ADMIN" && form.pin?.length < 4) {
      push("error", "ADMIN must have a PIN (4-8 digits).");
      return;
    }

    setLoading(true);
    try {
      if (editing && currentUser?.id) {
        await updateUser(currentUser.id, {
          name: form.name.trim(),
          role: form.role,
          isActive: form.isActive,
          pin: form.pin || undefined,
        });
        push("success", `User "${form.name}" updated.`);
      } else {
        await createUser({
          name: form.name.trim(),
          role: form.role,
          pin: form.pin || undefined,
        });
        push("success", `User "${form.name}" created.`);
      }
      closeModals();
      void loadUsers();
    } catch {
      push("error", "Failed to save user. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Delete user
  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteUser(id);
      push("success", "User deleted.");
      void loadUsers();
    } catch {
      push("error", "Failed to delete user. Try again.");
    }
  };

  // Password reset
  const handleResetPassword = async (id: string): Promise<void> => {
    if (!window.confirm("Reset password and revoke active sessions for this user?")) return;
    try {
      await resetUserPassword(id);
      push("success", "Password reset sent.");
    } catch {
      push("error", "Failed to reset password. Try again.");
    }
  };

  // Empty state
  const emptyState = (
    <EmptyState
      title="No staff users yet"
      action={<Button variant="primary" onClick={() => openAddModal()}>Add First User →</Button>}
    />
  );

  const columns: Column<StaffUserType>[] = [
    {
      key: "name",
      header: "Name",
      render: (u) => <span className="block truncate font-medium text-[var(--color-text)]">{u.name}</span>,
    },
    {
      key: "role",
      header: "Role",
      render: (u) => <span className="font-medium text-[var(--color-text)]">{u.role}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (u) => <Badge tone={u.isActive ? "OK" : "LOW"}>{u.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "lastLogin",
      header: "Last Login",
      render: () => <span className="text-xs text-[var(--color-text-muted)]">—</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (u) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditModal(u)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id)} className="text-[var(--color-danger)]">Delete</Button>
          {u.role !== "ADMIN" && (
            <Button variant="ghost" size="sm" onClick={() => handleResetPassword(u.id)} className="text-[var(--color-success)]">Reset PW</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="h-full min-h-0 bg-[var(--color-surface)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Staff Management</h1>
        <Button variant="primary" onClick={() => openAddModal()}>+ Add User</Button>
      </div>

      {!loading && users.length === 0 ? (
        emptyState
      ) : (
        <Table
          columns={columns}
          data={users}
          rowKey={(u) => u.id}
          loading={loading}
          emptyMessage="No staff users yet"
        />
      )}

      {formOpen && (
        <Modal title={editing ? "Edit User" : "Add User"} onClose={closeModals}>
          <form onSubmit={(e) => { e.preventDefault(); void saveUser(); }} className="space-y-4">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
            <Select
              label="Role"
              value={form.role}
              onChange={onRoleChange}
              options={[
                { value: "CASHIER", label: "Cashier" },
                { value: "MANAGER", label: "Manager" },
                { value: "ADMIN", label: "Admin" },
              ]}
            />
            <Input
              label="PIN"
              type="password"
              passwordToggle
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value })}
              hint={editing ? "Leave blank to keep the current PIN." : "4–8 digits. Required for ADMIN."}
            />
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={closeModals}>Cancel</Button>
              <Button variant="primary" type="submit">{editing ? "Save changes" : "Create user"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

