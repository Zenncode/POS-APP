import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

// N2: the old global `offsetParent` shim is GONE — it made every element look
// visible, so Modal's focus-trap filter could never be tested for correctness.
// jsdom@30.0.1 does NOT implement Element.prototype.checkVisibility (verified:
// typeof === "undefined"), so without any polyfill Modal's feature-detect falls
// into the `offsetParent !== null` legacy branch and the trap silently disables
// itself in tests. Instead of faking layout, we polyfill the STANDARD API that
// real browsers provide (Modal.tsx then exercises its PRIMARY branch, exactly
// as in Chrome/Firefox/Safari). Ancestors are walked because jsdom's
// getComputedStyle doesn't propagate display:none from parents.
function hasVisibleAncestors(el: Element | null, options?: { checkVisibilityCSS?: boolean; contentVisibilityAuto?: boolean; opacityProperty?: boolean; visibilityProperty?: boolean }): boolean {
  for (let cur = el; cur; cur = cur.parentElement) {
    const cs = window.getComputedStyle(cur);
    if (cs.display === "none") return false;
    if (options?.visibilityProperty !== false && cs.visibility === "hidden") return false;
    if (cur === el && options?.opacityProperty && parseFloat(cs.opacity || "1") === 0) return false;
  }
  return true;
}

if (typeof Element.prototype.checkVisibility !== "function") {
  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    writable: true,
    value(this: Element, options?: { checkVisibilityCSS?: boolean; contentVisibilityAuto?: boolean; opacityProperty?: boolean; visibilityProperty?: boolean }): boolean {
      return hasVisibleAncestors(this, options);
    },
  });
}
