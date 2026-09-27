import { defineConfig } from "vite";

// No framework plugin: Vite's built-in esbuild handles .tsx with the automatic
// JSX runtime (tsconfig jsx: react-jsx). House rule: zero heavy deps.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  server: { port: 5173 },
  build: { outDir: "dist", sourcemap: true },
});

