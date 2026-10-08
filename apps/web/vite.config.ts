/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    proxy: { '/api': 'http://127.0.0.1:8891' },
  },
  // 여러 단계를 거치는 통합 테스트는 파일을 병렬로 돌릴 때(Stop 훅, CI) 기본 5초를 넘길 수 있다. 멈춘 테스트는 15초 안에 실패한다.
  test: { testTimeout: 15_000, setupFiles: ['./src/test-support/setup.ts'] },
})
