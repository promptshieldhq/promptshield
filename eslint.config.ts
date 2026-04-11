import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import markdown from "@eslint/markdown";
import { defineConfig } from "eslint/config";

const reactRecommendedConfigs = pluginReact.configs.flat.recommended
  ? (Array.isArray(pluginReact.configs.flat.recommended)
      ? pluginReact.configs.flat.recommended
      : [pluginReact.configs.flat.recommended]
    ).map((config) => ({
      ...config,
      files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    }))
  : [];

export default defineConfig([
  {
    ignores: [
      "**/node_modules/**",
      "**/.turbo/**",
      "**/.output/**",
      "**/.source/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.next/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  tseslint.configs.recommended,
  ...reactRecommendedConfigs,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    settings: { react: { version: "19.2" } },
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/prop-types": "off",
    },
  },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/gfm",
    extends: ["markdown/recommended"],
  },
]);
