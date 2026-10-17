import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The boundary of the frontend: it reaches data only through the backend's API (lib/api).
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@fm/backend", "@fm/backend/*"],
              allowTypeImports: true,
              message: "The frontend may import types from the backend, never code. Call the API through @/lib/api/client.",
            },
            {
              group: ["@fm/database", "@fm/database/*", "@prisma/*", "pg"],
              message: "The frontend does not touch the database. Add a route to the backend and call it through @/lib/api/client.",
            },
          ],
        },
      ],
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
