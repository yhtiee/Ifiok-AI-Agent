import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next registers the jsx-a11y plugin with a few rules; turn on the full recommended set.
  { files: ["**/*.{jsx,tsx}"], rules: jsxA11y.flatConfigs.recommended.rules },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "supabase/.temp/**",
    "playwright-report/**",
    "test-results/**",
    "packages/core/src/db/types.ts",
    // Deno code (Edge Functions) is checked by Deno, not the Next.js toolchain.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
