import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

/*
  Flat ESLint config (ESLint 9+). Lints the real app, server, tests and
  config files. The archived vanilla version is intentionally excluded —
  it is a teaching snapshot, not maintained code.
*/
export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "vanilla-version/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Context modules intentionally export a Provider component and a hook
    // from the same file; that pattern is safe and widely used.
    files: ["src/*Context.jsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
];
