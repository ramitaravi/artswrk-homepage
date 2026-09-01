import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    // client/src/lib holds pure browser logic with no React — the checkout-tab
    // opener in particular, whose whole contract is about *when* it runs.
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/src/lib/**/*.test.ts",
      // shared/ holds pure rules both sides depend on (booking money, job
      // status, password policy) — exactly the logic worth locking down.
      "shared/**/*.test.ts",
    ],
  },
});
