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
  server: {
    proxy: {
      // 화면 주소와 API 경로가 겹치므로 접두사로 가른다. 서버는 접두사 없이
      // 계약이 정의한 경로를 그대로 받는다. 배포에서는 API Gateway가 이 자리다.
      // 출처: apps/web/src/shared/api/base.ts
      "/api/v1": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
