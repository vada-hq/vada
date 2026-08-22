/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// specs/figma의 명세 번들과 packages/contracts를 저장소 루트 기준으로 import한다.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // 선택 목록 mock은 관례상 450ms 지연을 둔다(vada-conventions 7번).
    // 연쇄 선택을 여러 번 밟는 화면 테스트는 debounce 300ms까지 더해져
    // 기본 5초에 근접하고 부하가 걸리면 간헐적으로 넘긴다. 지연을 줄이면
    // 로딩 상태 단언이 불안정해지므로 인내값만 올린다.
    testTimeout: 20000,
    // 부하가 걸리면 워커 기동 자체가 타임아웃된다("Failed to start forks worker",
    // "Vitest failed to find the current suite"). 테스트 실패가 아니라 자원
    // 경합이므로 세 가지로 막는다.
    //   - 스레드 풀: Windows에서 프로세스 fork는 기동이 느려 경합에 약하다
    //   - 병렬도 2: 브리지·Playwright가 같이 돌 때를 견딘다
    //   - hookTimeout: 환경 준비(jsdom)가 느려도 죽이지 않는다
    // DOM이 필요 없는 테스트 3개는 파일 상단 docblock으로 node 환경을 쓴다.
    pool: 'threads',
    maxWorkers: 2,
    hookTimeout: 30000,
    // e2e는 Playwright 러너 담당이므로 vitest 수집에서 제외한다.
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
})
