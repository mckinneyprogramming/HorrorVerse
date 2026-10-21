import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "virtual:pwa-register": path.resolve(root, "test-helpers/pwa-register.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "lib/**/*.test.ts", "api-src/**/*.test.ts", "scripts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts", "lib/**/*.ts", "api-src/**/*.ts", "scripts/**/*.mjs"],
      exclude: ["src/**/*.test.ts", "lib/**/*.test.ts", "api-src/**/*.test.ts", "scripts/**/*.test.ts"],
    },
  },
});
