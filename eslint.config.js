import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "build/**",
      ".react-router/**",
      "public/**",
      "*.config.{ts,js,mjs,cjs}",
      "react-router.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    // N3 documented downgrade (error -> warn, never off): react-hooks v7's
    // set-state-in-effect flags 10 established fetch-on-mount / SSR-hydrate
    // effects (register/orders/shift/dashboard/staff, Topbar clock, useCart,
    // useShift, useTheme) that call setLoading/setMode synchronously before
    // awaiting. Correct rework (use action / useOptimistic / route loaders /
    // lazy client-only state) is a refactor project, not a lint-adoption
    // change. Rule stays visible as warnings.
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
);
