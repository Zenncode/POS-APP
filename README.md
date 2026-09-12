# POS-APP — Minimalist POS Terminal (functional, frontend-only)

React Router 7 framework mode + Tailwind 4. Monochrome + emerald (#059669), Inter,
8pt grid. API untouched — this app only consumes `POS-API`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 — /api proxied to http://localhost:3000
```

Live API:

```bash
# POS-API on :3000, then in POS-APP:
npm run dev
# or point elsewhere:
# VITE_API_URL=http://localhost:3000 npm run dev
```

Demo mode (API offline): sign in with any `@example.com` email + 4-char password.
Seeded catalog/orders/reports load, checkout builds a local `ORD-LOCAL-*` order
labeled "Saved offline (demo)".

## Screens

| Route | What |
|---|---|
| `/login` | Staff sign-in (JWT + refresh, demo fallback) |
| `/register` | Sell screen: search/barcode (F2/Enter) · category rail · product grid · cart + discount · Charge (F8) → cash (quick chips + change) / card / QR · `Idempotency-Key` per cart session |
| `/orders` | History + search + status filter · detail (items/payments) · void (manager direct, cashier needs PIN → `X-Override-Token`) |
| `/products` | Catalog table (SKU/price/stock), create, +1/−1/+10 stock adjust, archive |
| `/customers` | Search name/phone, loyalty + recent orders |
| `/dashboard` | Daily report: sales/orders/avg/low-stock + sales-by-hour CSS bars + top 5 (manager+ live, demo offline) |
| `/settings` | Device prefs, connection test, shortcut list |

## API mapping (POS-API `docs/endpoints.md`)

- `POST /api/auth/login|refresh|logout`, `GET /api/auth/me`, `POST /api/auth/override`
- `GET /api/categories`, `GET /api/products?q&categoryId`, `GET /api/products/barcode/:code`
- `POST /api/products`, `POST /api/products/:id/adjust-stock`, `DELETE /api/products/:id`
- `POST /api/orders` (+ `Idempotency-Key`), `GET /api/orders?page&status&q`, `GET /api/orders/:id`, `POST /api/orders/:id/void` (+ `X-Override-Token`)
- `GET /api/reports/sales/daily?date=YYYY-MM-DD`, `GET /api/health` (public, no auth header)
- Socket.IO optional (`auth.token`, `join:store`) — degrades to polling when package absent

Money stays integer cents end-to-end, formatted only at render (`cents/100`).
Tax per line from `taxRateBps` (cart mirrors server; offline fallback uses per-line rates).

## Checks

```bash
npx tsc --noEmit --skipLibCheck   # clean
npm run test:unit                 # 12/12 (formatCents/parseToCents/calcLineTax)
npm run build                     # green
```
