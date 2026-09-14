import { Link, Navigate, Outlet, useLocation } from "react-router";
import type { JSX } from "react";
import { Sidebar } from "../components/layout/Sidebar";
import { Topbar } from "../components/layout/Topbar";
import { useAuth } from "../hooks/useAuth";
import { roleAtLeast } from "../hooks/useAuth";
import type { StaffUser } from "~/types";

const TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/register": { title: "Register", subtitle: "F2 search · F8 charge · Esc close" },
  "/shift": { title: "Shift", subtitle: "Open/close float · drawer count · variance" },
  "/dashboard": { title: "Dashboard", subtitle: "Today's performance" },
  "/orders": { title: "Orders", subtitle: "Sales history · voids need a manager PIN" },
  "/products": { title: "Products", subtitle: "Catalog · stock · pricing (cents-accurate)" },
  "/customers": { title: "Customers", subtitle: "Search by name or phone" },
  "/settings": { title: "Settings", subtitle: "Store · device · API" },
};

const NAV_ITEMS = [
  "/register",
  "/shift",
  "/orders",
  "/products",
  "/dashboard",
  "/customers",
  "/settings",
  "/staff-management",
  "/refund",
];

const NAV_LABELS: Record<string, string> = {
  "/register": "Register",
  "/shift": "Shift",
  "/orders": "Orders",
  "/products": "Products",
  "/dashboard": "Dashboard",
  "/customers": "Customers",
  "/settings": "Settings",
  "/staff-management": "Staff",
  "/refund": "Refund",
};

function canSeeNav(role: StaffUser["role"] | undefined, item: string): boolean {
  // ADMIN sees everything
  if (roleAtLeast(role, "ADMIN")) return true;
  // MANAGER sees everything except staff management & settings
  if (roleAtLeast(role, "MANAGER")) {
    // MANAGER can see all core ops
    return !item.startsWith("/settings") && item !== "/staff-management";
  }
  // CASHIER sees only register + orders (own orders) + customers (walk-in)
  if (!roleAtLeast(role, "MANAGER")) {
    // CASHIER: register, orders (own), customers
    if (item === "/settings" || item === "/products" || item === "/staff-management") return false;
    if (item === "/dashboard") return false; // dashboard is manager+
    return true;
  }
  return false;
}

export function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="size-6 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-700" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

export default function MainLayout(): JSX.Element {
  const loc = useLocation();
  const base = `/${loc.pathname.split("/")[1] ?? ""}`;
  const meta = TITLES[base] ?? TITLES["/register"];
  const { user } = useAuth();

  // CartProvider lives in root.tsx above the Outlet — every route shares one cart.
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar title={meta.title} subtitle={meta.subtitle} />
          {/* Mobile nav — always shows core items for the role */}
          <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2 md:hidden" aria-label="Mobile">
            {NAV_ITEMS.filter((item) => canSeeNav(user?.role, item)).map((to) => (
              <Link
                key={to}
                to={to}
                aria-current={base === to ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  base === to ? "bg-gray-100 font-medium text-gray-900" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {NAV_LABELS[to]}
              </Link>
            ))}
          </nav>
          <main className="min-h-0 flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>
  );
}
