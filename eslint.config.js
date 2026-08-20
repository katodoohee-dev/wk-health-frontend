import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist", ".output", ".vinxi", "node_modules"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    rules: {},
  },
];
