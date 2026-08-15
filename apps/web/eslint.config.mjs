import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tailwind from "eslint-plugin-tailwindcss";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  tailwind.configs.recommended,
  {
    settings: {
      tailwindcss: {
        cssConfigPath: "src/app/globals.css",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-html-link-for-pages": "off",
      "tailwindcss/no-custom-classname": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react/jsx-key": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
