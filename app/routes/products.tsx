import { useCallback, useEffect, useState } from "react";
import type { JSX } from "react";
import { adjustStock, archiveProduct, createProduct, listCategories, listProducts } from "~/lib/api";
import { formatCents, parseToCents } from "~/lib/format";
import { useAuth } from "~/shared/hooks/useAuth";
import { useToast } from "~/shared/hooks/useToast";
import { Badge } from "~/shared/components/ui/Badge";
import { Button } from "~/shared/components/ui/Button";
import { EmptyState, Spinner } from "~/shared/components/ui/Feedback";
import { Input } from "~/shared/components/ui/Input";
import { Modal } from "~/shared/components/ui/Modal";
import type { Category, Product, StaffUser } from "~/types";
import { roleAtLeast } from "~/shared/hooks/useAuth";

export function meta(): { title: string }[] {
  return [{ title: "Products — POS Terminal" }];
}

function canManageProducts(role: StaffUser["role"] | undefined): boolean {
  // Only MANAGER+ can create, adjust stock, archive products
  return roleAtLeast(role, "MANAGER");
}

export default function Products(): JSX.Element {
  const { user } = useAuth();
  const role = user?.role as StaffUser["role"] | undefined;
  const { push } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catId, setCatId] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", price: "", stock: "0", barcode: "" });
  const [saving, setSaving] = useState(false);

  const canManage = canManageProducts(role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, prods] = await Promise.all([
        listCategories(),
        listProducts({ categoryId: catId || undefined, q: q || undefined, pageSize: 200 }),
      ]);
      setCategories(cats);
      setProducts(prods.data);
    } catch {
      push("error", "Failed to load products. Try again.");
    } finally {
      setLoading(false);
    }
  }, [catId, q, push, canManage]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [load]);

  async function onCreate(): Promise<void> {
    if (!form.sku.trim() || !form.name.trim() || !form.price.trim()) {
      push("error", "SKU, name and price are required.");
      return;
    }
    const cents = parseToCents(form.price);
    if (!Number.isFinite(cents) || cents <= 0) {
      push("error", "Price must be greater than 0.");
      return;
    }
    const st = Number(form.stock);
    if (!Number.isInteger(st) || st < 0) {
      push("error", "Stock must be a whole number 0 or more.");
      return;
    }
    setSaving(true);
    try {
      await createProduct({
        sku: form.sku.trim(),
        name: form.name.trim(),
        priceCents: cents,
        stock: st,
        barcode: form.barcode.trim() || null,
        categoryId: catId || null,
      });
      push("success", `${form.name} created`);
      setCreateOpen(false);
      setForm({ sku: "", name: "", price: "", stock: "0", barcode: "" });
      void load();
    } catch {
      push("error", "Create failed. Check SKU and price.");
    } finally {
      setSaving(false);
    }
  }

  async function onAdjust(p: Product, delta: number): Promise<void> {
    if (delta === 0) return;
    try {
      await adjustStock(p.id, delta, delta > 0 ? "PURCHASE" : "ADJUST");
      push("success", `${p.name} ${delta > 0 ? "+" : ""}${delta}`);
      void load();
    } catch {
      push("error", "Stock adjust failed. Manager only in live mode.");
    }
  }

  async function onArchive(p: Product): Promise<void> {
    if (!window.confirm(`Archive ${p.name}? It will hide from the register.`)) return;
    try {
      await archiveProduct(p.id);
      push("success", `${p.name} archived`);
      void load();
    } catch {
      push("error", "Archive failed. Try again.");
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="w-[220px] shrink-0 border-r border-gray-200 bg-white p-3">
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-gray-500">Categories</p>
        <button onClick={() => setCatId("")} className={`mb-1 w-full rounded-lg border-l-2 px-3 py-2 text-left text-sm ${catId === "" ? "border-emerald-700 bg-gray-100 font-medium text-gray-900" : "border-transparent text-gray-700 hover:bg-gray-50"}`}>All</button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => setCatId(c.id)} className={`mb-1 w-full rounded-lg border-l-2 px-3 py-2 text-left text-sm ${catId === c.id ? "border-emerald-700 bg-gray-100 font-medium text-gray-900" : "border-transparent text-gray-700 hover:bg-gray-50"}`}>
            <span className="block truncate">{c.name}</span>
          </button>
        ))}
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="mb-4 flex gap-2">
          <div className="max-w-sm flex-1">
            <Input placeholder="Search SKU, name, barcode…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
          </div>
          {canManage && (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>+ Product</Button>
          )}
          {!canManage && (
            <span className="text-[13px] text-gray-500">Managers only</span>
          )}
        </div>

        {loading ? (
          <Spinner />
        ) : products.length === 0 ? (
          <EmptyState title="No products in this view. Add one →" action={<Button variant="primary" onClick={() => setCreateOpen(true)}>+ Product</Button>} />
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[13px] text-gray-500">
                  <th className="px-4 py-2 font-medium">SKU / Name</th>
                  <th className="px-4 py-2 text-right font-medium">Price</th>
                  <th className="px-4 py-2 text-right font-medium">Stock</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs tabular-nums text-gray-400">{p.sku}{p.barcode ? ` · ${p.barcode}` : ""}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{formatCents(p.priceCents)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{p.stock}</td>
<td className="px-4 py-2.5">
                      {p.stock <= 0 ? <Badge tone="LOW">Out</Badge> : p.stock <= p.lowStockThreshold ? <Badge tone="LOW">Low</Badge> : <Badge tone="OK">OK</Badge>}
                    </td>
                    <td className="px-4 py-2.5">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => void onAdjust(p, 1)} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" title="Stock +1">+1</button>
                          <button onClick={() => void onAdjust(p, -1)} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" title="Stock −1">−1</button>
                          <button onClick={() => void onAdjust(p, 10)} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" title="Restock +10">+10</button>
                        </div>
                      ) : null}
                      <button onClick={() => void onArchive(p)} className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50">Archive</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {createOpen ? (
          <Modal title="New product" onClose={() => setCreateOpen(false)}>
            <div className="flex flex-col gap-3">
              <Input label="SKU *" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="CF-005" />
              <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mocha" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Price * (₱)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="4.50" inputMode="decimal" />
                <Input label="Opening stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} inputMode="numeric" />
              </div>
              <Input label="Barcode (optional)" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="100005" />
              <div className="mt-1 flex gap-2">
                <Button variant="ghost" full onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button variant="primary" full onClick={() => void onCreate()} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
              </div>
            </div>
          </Modal>
        ) : null}
      </div>
    </div>
  );
}
