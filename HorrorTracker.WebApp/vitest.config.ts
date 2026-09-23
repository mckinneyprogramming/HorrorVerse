import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "lib/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts", "lib/**/*.ts"],
      exclude: ["src/**/*.test.ts", "lib/**/*.test.ts"],
    },
  },
});

