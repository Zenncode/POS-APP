import { useState, useEffect } from "react";
import type { JSX } from "react";
import { listUsers, createUser, updateUser, deleteUser, resetUserPassword } from "~/lib/api";
import { useAuth, roleAtLeast } from "~/shared/hooks/useAuth";
import { useToast } from "~/shared/hooks/useToast";
import { Button } from "~/shared/components/ui/Button";
import { Input } from "~/shared/components/ui/Input";
import { EmptyState, Spinner } from "~/shared/components/ui/Feedback";
import { Navigate } from "react-router";
import type { StaffUser, StaffUser as StaffUserType } from "~/types";

export function meta(): { title: string }[] {
  return [{ title: "Staff Management — POS Terminal" }];
}

function canManageUsers(role: StaffUserType["role"] | undefined): boolean {
  return roleAtLeast(role, "ADMIN");
}

export default function StaffManagement(): JSX.Element {
  const { user } = useAuth();
  const { push } = useToast();

  // Can't proceed if not ADMIN
  if (!canManageUsers(user?.role)) {
    push("error", "Admin access required.");
    return <Navigate to="/register" replace />;
  }

  const role = user?.role;

  const [users, setUsers] = useState<StaffUserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<StaffUserType | null>(null);
  const [form, setForm] = useState({ name: "", role: "CASHIER" as StaffUserType["role"], pin: "", isActive: true });

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

  // Load users
  useEffect(() => {
    void loadUsers();
  }, [push]);

  // Reset form
  const resetForm = (): void => {
    setForm({ name: "", role: "CASHIER" as StaffUserType["role"], pin: "", isActive: true });
  };

  // Handle role change in form
  const onRoleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setForm({ ...form, role: e.target.value as StaffUserType["role"] });
  };

  // Open add user modal
  const openAddModal = (): void => {
    resetForm();
    setEditing(false);
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
  };

  // Close modals
  const closeModals = (): void => {
    setEditing(false);
    setCurrentUser(null);
    resetForm();
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
  const emptyState = users.length === 0 ? (
    <EmptyState
      title="No staff users yet"
      action={<Button variant="primary" onClick={() => openAddModal()}>Add First User →</Button>}
    />
  ) : null;

  // User row
  const userRow = (u: StaffUserType): JSX.Element => (
    <tr key={u.id} className="hover:bg-gray-50">
      <td className="px-4 py-2 font-medium text-gray-900 truncate">{u.name}</td>
      <td className="px-4 py-2 font-medium text-gray-900">{u.role}</td>
      <td className="px-4 py-2">
        <span className={`inline-block rounded text-[11px] font-medium ${
          u.isActive ? "text-emerald-600 bg-emerald-100" : "text-red-600 bg-red-100"
        }`}>
          {u.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-2 text-xs text-gray-500">—</td>
      <td className="px-4 py-2 text-right">
        <Button variant="ghost" size="sm" onClick={() => openEditModal(u)}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id)} className="text-red-600">Delete</Button>
        {u.role !== "ADMIN" && (
          <Button variant="ghost" size="sm" onClick={() => handleResetPassword(u.id)} className="text-emerald-600">Reset PW</Button>
        )}
      </td>
    </tr>
  );

  return (
    <div className="h-full min-h-0 bg-gray-50 p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Staff Management</h1>
        <Button variant="primary" onClick={() => openAddModal()}>+ Add User</Button>
      </div>

      {emptyState}

      <div className="overflow-x-auto">
        <table className="min-w-max table-fixed w-full border-collapse border-gray-200">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Last Login</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
            {users.map(userRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}