import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// The benchmark imports react-fastload directly from source (not the built
// dist/) so it always reflects the current state of the library during
// development. `npm run build` in the library root produces the real
// published package for actual consumers.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "react-fastload": path.resolve(__dirname, "../src/index.ts"),
    },
  },
});
