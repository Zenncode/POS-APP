# POS-APP — Minimalist UI Design (Suggestion)

Design direction for the cashier-facing web app. Goal: **speed at the register** — every
screen answers "what do I do next" in one glance, with zero decoration.

## Principles

1. **Content is the interface.** No cards-on-cards, no shadows, no gradients. Flat surfaces separated by 1px hairlines and whitespace.
2. **Cashier muscle memory.** Biggest click targets in the world = product grid and pay button. Everything else is secondary text.
3. **One accent color, used only for money and actions.** Monochrome gray palette + a single emerald accent. Money is never gray.
4. **8pt grid everywhere.** Spacing, sizes, and layout all snap to 8px (4px for hairline offsets).
5. **Type is the hierarchy.** Weight/size does the work color would normally do.

## Foundations

| Token | Value |
| --- | --- |
| Font | Inter (or system-ui fallback); tabular numerals for all money |
| Radii | 8px inputs/buttons, 14px modals; nothing rounder |
| Spacing | 8px base: 4 / 8 / 16 / 24 / 32 |
| Ink | `#111827` primary, `#6B7280` secondary, `#E5E7EB` hairline, `#F9FAFB` page bg |
| Accent | Emerald `#059669` (pay button, positive totals, live badge) |
| Danger | `#DC2626` (void, destructive only) |
| Money | Always `$X.XX`, tabular numerals, right-aligned |

Component recipe: buttons = flat fill, label only, 40px height; inputs = 1px border,
white bg, no inner shadow; tables = hairline rows, no zebra; toasts = top-center, 4s.

## Screens (React Router 7 framework mode, feature folders per zenncode.md)

### Login
Single centered column (max 360px): logo-less wordmark, email, password, full-width
"Sign in". No hero, no marketing. Error text inline under fields in red.

### Register (the POS screen — default after login)
Three-pane layout, full viewport height, no page scroll:

- **Left rail 240px** — search input (autofocus, `F2`), category list (hairline rows,
  active = left 2px accent bar), low-stock count badge at bottom.
- **Center, fluid** — product grid: 3–6 columns responsive; each tile = product name +
  price only (photo optional later); tap adds to cart with a 150ms press feedback.
- **Right cart 380px** — line rows (qty stepper, name, line total), hairline separated;
  footer: subtotal / tax / discount / **TOTAL** (large, accent), then full-width
  **Charge `F8`** button in emerald.

Charge flow: payment sheet slides over the cart pane — cash tendered with quick-amount
chips (exact, $20, $50, $100) + numeric pad; card/QR just show a reference input.
Success state = centered check + change due, auto-dismiss 3s, cart clears. Offline or
failure = order stays in cart, toast explains. Send `Idempotency-Key` (uuid per charge
attempt) with every checkout.

### Orders
Dense list: date, order number, cashier, items count, status pill (PAID = neutral,
VOID = red outline, REFUNDED = amber), total right-aligned. Filters as simple text
chips (Today / status / cashier). Row → order detail: items, payments, void action
(manager only, confirm modal).

### Products / Categories
Two-pane manager screen: left = category tree, right = product table (SKU, name,
price, stock, status). Stock adjustments inline (+/− with reason prompt). Archive via
row action, undo toast 5s.

### Customers
Search-first list (phone/name), detail drawer with last 10 orders + loyalty points.

### Settings (ADMIN)
Bare form list: store info, receipt footer, tax defaults, device label. No tabs.

### Dashboard (MANAGER+)
One stat row (today's sales, orders, avg ticket, low stock) + "sales by hour"
sparkline + top 5 products. Everything from `/api/reports/sales/daily`. No charts
library — CSS bars suffice.

## Interaction Rules

- Keyboard first: `F2` search, `F3` customer, `F4` discount, `F8` charge, `Esc` close
  overlays, `Enter` confirms dialogs. Every action reachable in ≤2 keystrokes.
- Live updates: socket `order:created`/`stock:low`/`order:voided` update lists without
  refresh; small accent dot on affected rows for 2s.
- Optimistic UI for cart math (client-side pricing mirrors API: cents math, bps tax);
  server response is the source of truth on charge.
- Empty states are one sentence + one action ("No products in General. Add one →").

## Data Layer Sketch

- `app/lib/httpClient.ts` — fetch wrapper: base URL, bearer token, refresh-on-401 once,
  money stays integer cents end-to-end (format only at render: `cents/100`).
- `app/lib/socketClient.ts` — singleton socket with `auth: { token }`, reconnect + room
  join `join:store`.
- `app/hooks/` — `useCart` (local state, per-tab), `useAuth` (token storage + user),
  `useLiveOrders` (socket subscription).

## Anti-Goals

- No dashboards-for-show, dark patterns, onboarding carousels, theme switcher.
- No client-side price formatting logic beyond `cents/100` — no currency math in JS.
- No modals stacked on modals; one overlay level deep, ever.
