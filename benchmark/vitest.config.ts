import { defineConfig } from "vitest/config";
import path from "node:path";

// Test setup for the benchmark app's own pure helper functions
// (lab/derivedMetrics.ts, lab/synthetic.ts, overview/deriveMetrics.ts).
// They need no DOM, so the default "node" environment is enough.
//
// This lives in its own file (Vitest prefers vitest.config.ts over
// vite.config.ts) so that vite.config.ts can stay a plain Vite config with
// the React plugin and the SEO/HTML plugin.
export default defineConfig({
  resolve: {
    alias: {
      "react-fastload": path.resolve(__dirname, "../src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
