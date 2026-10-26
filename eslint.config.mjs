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
  // Guardrail 7 (03 §9): retrieval runs only through lib/ai/retrieve.ts, which takes the user id
  // from the signed-in viewer. No other file may call match_chunks…
  {
    // Tests and eval scripts query as named test accounts on purpose; app code may not.
    ignores: ["lib/ai/retrieve.ts", "**/*.integration.test.ts", "scripts/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='rpc'][arguments.0.value='match_chunks']",
          message: "Call retrieveChunks() from lib/ai/retrieve.ts: it scopes retrieval to the signed-in user.",
        },
      ],
    },
  },
  // …and retrieve.ts never touches a request, so no user id can come from a body or URL.
  {
    files: ["lib/ai/retrieve.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Identifier[name=/^(request|req|body|params|searchParams|payload|userId|user_id)$/]:not(MemberExpression[object.name='viewer'] > Identifier)",
          message: "Retrieval takes the user id from the Viewer only (guardrail 7).",
        },
      ],
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
