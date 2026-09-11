import type { ReactNode } from "react";
import Navbar from "../components/layout/Navbar";

type MainLayoutProps = {
  children: ReactNode;
};

const MainLayout = ({ children }: MainLayoutProps): JSX.Element => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
};

export default MainLayout;
