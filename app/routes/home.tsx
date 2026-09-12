import { Navigate } from "react-router";
import type { JSX } from "react";

export function meta(): { title: string }[] {
  return [{ title: "POS Terminal" }];
}

export default function Home(): JSX.Element {
  return <Navigate to="/register" replace />;
}
