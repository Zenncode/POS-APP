// Unit tests for pure POS business rules (app/lib/posRules.ts).
// Run with: npm run test:unit (node --test).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DENOMINATIONS_CENTS,
  DISCOUNT_MAX_CENTS,
  DISCOUNT_MAX_PCT,
  discountOverThreshold,
  expectedCashCents,
  floatCents,
  splitOverpayAllowed,
  splitRemainingCents,
  toCounts,
  validEmail,
  validPhone,
  varianceCents,
} from "../../app/lib/posRules.ts";

test("floatCents sums denomination × count", () => {
  assert.equal(floatCents([{ denomination: 100000, count: 2 }, { denomination: 100, count: 3 }]), 200300);
});

test("floatCents ignores junk rows (zero/negative/non-integer)", () => {
  assert.equal(
    floatCents([
      { denomination: 100000, count: 1 },
      { denomination: -5, count: 3 },
      { denomination: 0, count: 9 },
      { denomination: 500, count: 0 },
    ]),
    100000,
  );
  assert.equal(floatCents([]), 0);
});

test("toCounts floors, drops zero counts, sorts desc", () => {
  const c = toCounts({ 100: 2.9, 5000: 1, 100000: 0 });
  assert.deepEqual(c, [
    { denomination: 5000, count: 1 },
    { denomination: 100, count: 2 },
  ]);
});

test("discount threshold: % boundary — exactly 10% OK, 10%+1 cent over", () => {
  assert.equal(DISCOUNT_MAX_PCT, 10);
  const total = 10000; // $100 → 10% cap = $10
  assert.equal(discountOverThreshold(1000, total), false);
  assert.equal(discountOverThreshold(1001, total), true);
});

test("discount threshold: cents boundary — exactly $500 OK, $500.01 over", () => {
  assert.equal(DISCOUNT_MAX_CENTS, 50000);
  assert.equal(discountOverThreshold(50000, 1_000_000), false); // 5% of big total
  assert.equal(discountOverThreshold(50001, 1_000_000), true);
});

test("discount threshold edges: 0/none, zero total, 100% discount", () => {
  assert.equal(discountOverThreshold(0, 1000), false);
  assert.equal(discountOverThreshold(-5, 1000), false);
  assert.equal(discountOverThreshold(100, 0), false); // empty cart can't carry a discount (UI blocks)
  assert.equal(discountOverThreshold(1000, 1000), true); // 100% > 10%
});

test("splitRemainingCents: exact, short, overpay", () => {
  assert.equal(splitRemainingCents(2500, [{ amountCents: 1500 }, { amountCents: 1000 }]), 0);
  assert.equal(splitRemainingCents(2500, [{ amountCents: 1000 }]), 1500);
  assert.equal(splitRemainingCents(2500, [{ amountCents: 2000 }, { amountCents: 1000 }]), -500);
});

test("splitOverpayAllowed: cash may overpay, card/QR may not (BR-04)", () => {
  assert.equal(splitOverpayAllowed([{ method: "CASH", amountCents: 1000 }, { method: "CARD", amountCents: 1000 }], 1500), true);
  assert.equal(splitOverpayAllowed([{ method: "CARD", amountCents: 1000 }, { method: "QR", amountCents: 1000 }], 1500), false);
  assert.equal(splitOverpayAllowed([{ method: "CARD", amountCents: 750 }, { method: "QR", amountCents: 750 }], 1500), true); // exact is always fine
});

test("expectedCashCents: float + cash received − cash change, ignores non-cash/unpaid", () => {
  const order = (status: string, pays: { method: string; amountCents: number }[], change: number) =>
    ({ status, payments: pays, changeCents: change }) as never;
  const orders = [
    order("PAID", [{ method: "CASH", amountCents: 5000 }], 1000),
    order("PAID", [{ method: "CARD", amountCents: 4000 }], 0),
    order("PENDING", [{ method: "CASH", amountCents: 9999 }], 0),
    order("VOID", [{ method: "CASH", amountCents: 8888 }], 0),
  ];
  assert.equal(expectedCashCents(20000, orders), 20000 + 5000 - 1000);
});

test("varianceCents sign: counted − expected", () => {
  assert.equal(varianceCents(10000, 10500), 500);
  assert.equal(varianceCents(10000, 9400), -600);
  assert.equal(varianceCents(0, 0), 0);
});

test("DENOMINATIONS_CENTS are positive cents descending", () => {
  assert.ok(DENOMINATIONS_CENTS.every((d) => Number.isInteger(d) && d > 0));
  for (let i = 1; i < DENOMINATIONS_CENTS.length; i++) {
    assert.ok(DENOMINATIONS_CENTS[i - 1] > DENOMINATIONS_CENTS[i]);
  }
});

test("validEmail: accepts real, rejects junk", () => {
  assert.equal(validEmail("cust@shop.example"), true);
  assert.equal(validEmail("  a.b+c@d-e.example "), true);
  assert.equal(validEmail("no-at-sign.example"), false);
  assert.equal(validEmail("@"), false);
  assert.equal(validEmail("a@"), false);
  assert.equal(validEmail("a@b"), false);
  assert.equal(validEmail(""), false);
});

test("validPhone: ≥7 digits, separators allowed", () => {
  assert.equal(validPhone("+1 (555) 010-2030"), true);
  assert.equal(validPhone("5550102"), true);
  assert.equal(validPhone("555-010"), false);
  assert.equal(validPhone("abcdefg"), false);
  assert.equal(validPhone(""), false);
});
