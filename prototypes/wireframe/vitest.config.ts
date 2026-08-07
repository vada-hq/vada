import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// 테스트 전용 설정 — 앱 빌드용 cloudflare/sites/tailwind 플러그인은 제외하고 React 변환 + jsdom만 사용한다.
export default defineConfig({
  plugins: [react({ babel: { compact: false } })],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    include: ['src/**/*.test.tsx'],
  },
})
