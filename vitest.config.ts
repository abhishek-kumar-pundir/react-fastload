import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Without this, Vitest's default include pattern recurses into
    // benchmark/ too (it's a separate package with its own vitest.config.ts
    // and "react-fastload" import alias) — the library's own `npm test`
    // should only ever run the library's own tests under /tests.
    exclude: ["**/node_modules/**", "benchmark/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});