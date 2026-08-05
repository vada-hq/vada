/// <reference types="vitest/config" />
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    // React Compiler 활성화 — 수동 useMemo/useCallback 금지 (ADR: 프레임워크)
    babel({ presets: [reactCompilerPreset()] }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
