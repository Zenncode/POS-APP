// Money-math unit tests — Node built-in runner, zero new deps.
// Run: npm run test:unit
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcLineTax, formatCents, parseToCents } from "../../app/lib/format.ts";

describe("formatCents", () => {
  it("happy path", () => assert.equal(formatCents(1999), "₱19.99"));
  it("zero", () => assert.equal(formatCents(0), "₱0.00"));
  it("negative shows sign", () => assert.equal(formatCents(-500), "-₱5.00"));
  it("custom currency", () => assert.equal(formatCents(100, "€"), "€1.00"));
});

describe("parseToCents", () => {
  it("strips currency symbol", () => assert.equal(parseToCents("₱19.99"), 1999));
  it("empty → 0", () => assert.equal(parseToCents(""), 0));
  it("garbage → 0", () => assert.equal(parseToCents("abc"), 0));
  it("negative", () => assert.equal(parseToCents("-5.00"), -500));
});

describe("calcLineTax", () => {
  it("10% happy path", () => assert.equal(calcLineTax(1000, 2, 1000), 200));
  it("qty 0 → 0", () => assert.equal(calcLineTax(1000, 0, 1000), 0));
  it("rate 0 → 0", () => assert.equal(calcLineTax(1000, 2, 0), 0));
  it("rounds", () => assert.equal(calcLineTax(333, 1, 1000), 33));
});
