import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  // Public
  route("login", "routes/login.tsx"),
  // App shell (sidebar + auth guard inside layout)
  layout("shared/layouts/AppShell.tsx", [
    index("routes/home.tsx"),
    route("register", "routes/register.tsx"),
    route("shift", "routes/shift.tsx"),
    route("dashboard", "routes/dashboard.tsx"),
    route("orders", "routes/orders.tsx"),
    route("orders/:id", "routes/order-detail.tsx"),
    route("refund", "routes/refund.tsx"),
    route("products", "routes/products.tsx"),
    route("customers", "routes/customers.tsx"),
    route("settings", "routes/settings.tsx"),
  ]),
] satisfies RouteConfig;
