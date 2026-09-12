import { NavLink } from "react-router";
import type { JSX } from "react";
import { useAuth, roleAtLeast } from "~/shared/hooks/useAuth";

const NAV = [
  { to: "/register", label: "Register", icon: "◉", hint: "Sell" },
  { to: "/dashboard", label: "Dashboard", icon: "▤", hint: "Today", manager: true },
  { to: "/orders", label: "Orders", icon: "≡", hint: "History" },
  { to: "/products", label: "Products", icon: "▦", hint: "Catalog", manager: true },
  { to: "/customers", label: "Customers", icon: "○", hint: "CRM" },
  { to: "/settings", label: "Settings", icon: "⚙", hint: "Store" },
] as const;

export function Sidebar(): JSX.Element {
  const { user, signOut, demoMode } = useAuth();

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">P</span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-gray-900">POS Terminal</p>
          <p className="text-xs text-gray-500">{demoMode ? "Demo mode" : "Live"} · {user?.role ?? "—"}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2" aria-label="Primary">
        {NAV.filter((n) => !("manager" in n && n.manager) || roleAtLeast(user?.role, "MANAGER") || demoMode).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
              }`
            }
          >
            <span className="w-5 text-center" aria-hidden>{n.icon}</span>
            <span className="flex-1 font-medium">{n.label}</span>
            <span className="text-xs opacity-60">{n.hint}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-200 p-3">
        <div className="mb-2 px-1">
          <p className="truncate text-sm font-medium text-gray-900">{user?.name ?? "Staff"}</p>
          <p className="truncate text-xs text-gray-500">{user?.email ?? ""}</p>
        </div>
        <button
          onClick={() => void signOut()}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
