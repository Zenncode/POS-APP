import { Outlet } from "react-router";
import type { JSX } from "react";
import MainLayout, { RequireAuth } from "./MainLayout";

export default function AppShell(): JSX.Element {
  return (
    <RequireAuth>
      <MainLayout />
    </RequireAuth>
  );
}

// Re-export outlet for clarity — MainLayout already renders <Outlet />
export function AppShellOutlet(): JSX.Element {
  return <Outlet />;
}
