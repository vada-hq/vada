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
    // 선택 목록 mock은 관례상 450ms 지연을 둔다(vada-conventions 7번).
    // 연쇄 선택을 여러 번 밟는 화면 테스트는 debounce 300ms까지 더해져
    // 기본 5초에 근접하고 부하가 걸리면 간헐적으로 넘긴다. 지연을 줄이면
    // 로딩 상태 단언이 불안정해지므로 인내값만 올린다.
    testTimeout: 20000,
    hookTimeout: 30000,
    // Windows에서 프로세스 fork는 기동이 느려 경합에 약하다. 병렬도 2는
    // 브리지·Playwright가 같이 돌 때를 견딘다.
    pool: 'threads',
    maxWorkers: 2,
    // 병목은 테스트가 아니라 jsdom 환경을 파일마다 새로 만드는 것이다.
    // 환경을 재사용하면 실행 시간이 준다(22s → 15s).
    //
    // 대가는 파일 사이에 전역이 공유된다는 것이다. 지금은 안전하다 —
    // 카탈로그는 읽기 전용 import이고, 화면 상태는 컴포넌트 안에 있으며,
    // setup이 테스트마다 DOM을 비운다. 전역을 건드리는 테스트가 생기면
    // 이 줄을 지우고 다시 격리해야 한다.
    isolate: false,
    // DOM이 필요한 테스트와 그렇지 않은 테스트를 환경별로 가른다.
    //
    // 파일마다 docblock으로 환경을 고르면 setup 파일 하나가 두 환경을 겸해야
    // 하고, 그러려면 DOM 도구를 동적 import로 미뤄야 한다. 그 await 뒤에서
    // afterEach를 걸면 vitest가 수집 문맥을 이미 닫아 간헐적으로 죽는다
    // ("Vitest failed to find the current suite"). 부하 문제가 아니라 순서
    // 문제이므로 환경을 갈라 setup을 정적 import로 되돌린다.
    //
    // 경계는 새로 선언하지 않는다 — 확장자가 이미 말하고 있다.
    // .tsx는 화면을 그리므로 DOM이 필요하고, .ts는 순수 로직이다.
    projects: [
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
})
