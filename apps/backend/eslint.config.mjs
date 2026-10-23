import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import globals from "globals"
import tseslint from "typescript-eslint"

// Every operation on a Prisma model delegate, so `x.quack.<op>` can be told
// apart from a domain object that merely has a `quack` field.
const PRISMA_OPERATIONS = [
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
].join("|")

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "node_modules/**", "prisma/**", "src/generated/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    // DTOs are presentation-layer types. Only files that own the HTTP boundary
    // (controllers and the DTOs themselves) may reference them. Anywhere else
    // should depend on domain types instead.
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.controller.ts", "src/**/controllers/**", "src/**/dto/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^\\.\\./",
              message:
                "Use the `@/` alias instead of climbing out of the folder with `../`. Relative imports are fine for siblings (`./`).",
            },
            {
              group: ["**/dto/**", "**/*.dto"],
              message:
                "DTOs are presentation-layer types and must only be imported by controllers (or other DTOs). Depend on the domain type instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // Controllers and DTOs are exempt from the rule above, so the relative-import
    // ban is restated for them: a later config replaces the rule, never merges.
    files: ["src/**/*.controller.ts", "src/**/controllers/**", "src/**/dto/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^\\.\\./",
              message:
                "Use the `@/` alias instead of climbing out of the folder with `../`. Relative imports are fine for siblings (`./`).",
            },
          ],
        },
      ],
    },
  },
  {
    // A deleted quack stays in the table (soft delete), and QuackRepository is
    // the one place that hides it from every read (`notDeleted`). Querying
    // quacks anywhere else, directly or through a relation of another model,
    // would quietly bring deleted ones back. The seed writes quacks on purpose.
    files: ["src/**/*.ts"],
    ignores: [
      "src/modules/quack/repositories/quack.repository.ts",
      "src/modules/quack/repositories/quack.repository.spec.ts",
      "src/scripts/seed/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `MemberExpression[property.name=/^(${PRISMA_OPERATIONS})$/] > MemberExpression.object[property.name="quack"]`,
          message:
            "Query quacks only in QuackRepository (src/modules/quack/repositories/quack.repository.ts): it is the one place that hides deleted quacks. Add a repository method there instead.",
        },
        {
          selector:
            "Property[key.name=/^(include|select|where|orderBy)$/] Property[key.name=/^quacks?$/]",
          message:
            "Don't reach quacks through a relation of another model: it skips the filter that hides deleted quacks. Ask QuackRepository for them instead.",
        },
      ],
    },
  },
  eslintConfigPrettier,
)
