// Money + date formatting. Money stays integer cents end-to-end —
// format ONLY at render. Tabular numerals keep columns aligned.

export function formatCents(cents: number, currency = "$"): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${currency}${(abs / 100).toFixed(2)}`;
}

export function parseToCents(input: string): number {
  const n = Number(input.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatQty(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `key-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function calcLineTax(unitPriceCents: number, qty: number, taxRateBps: number): number {
  return Math.round((unitPriceCents * qty * taxRateBps) / 10000);
}
