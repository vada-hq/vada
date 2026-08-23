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
    // 워커는 프로세스로 띄운다. 스레드는 워커들이 한 힙을 나눠 쓰므로,
    // 아래 isolate:false로 jsdom을 쌓아 두는 동안 압력이 한곳에 몰린다
    // (게이트가 "Worker exited unexpectedly"로 죽은 적이 있다). 프로세스는
    // 힙이 따로라 그 경로가 없고, 실측 속도도 같다(threads 14s · forks 15s).
    pool: 'forks',
    maxWorkers: 2,
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
          // 병목은 테스트가 아니라 jsdom 환경을 파일마다 새로 세우는 것이다.
          // 재사용하면 14s, 격리하면 35s — 2.5배다. 격리를 푸는 것은 값이
          // 나오는 이쪽뿐이고, node 프로젝트는 기본대로 격리한다.
          //
          // 대가는 파일 사이에 전역이 공유된다는 것이다. 지금은 안전하다 —
          // 카탈로그는 읽기 전용 import이고, 화면 상태는 컴포넌트 안에 있으며,
          // setup이 테스트마다 DOM을 비운다. 전역을 건드리는 테스트가 생기면
          // 이 줄을 지워야 한다.
          isolate: false,
          // 격리를 풀면 환경이 워커 안에 오래 남는다. 워커가 둘이면 그 하나의
          // 환경을 두고 수명이 엇갈려, 파일이 수집도 되기 전에 전부 죽는다
          // (게이트가 "Cannot read properties of undefined (reading 'config')"로
          // 세 번 막았다. 단독 실행은 통과하고 npm test 경로에서만 났다).
          //
          // 워커를 하나로 줄이면 그 경쟁이 사라진다. 속도 손해도 거의 없다 —
          // 애초에 이득의 출처가 병렬이 아니라 환경 재사용이기 때문이다.
          maxWorkers: 1,
          minWorkers: 1,
          // 두 프로젝트가 워커 수가 다르면 순서 묶음을 갈라야 한다(vitest가
          // 요구한다). 갈라 두면 dom과 node가 워커 풀을 공유하지 않는다.
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/*.test.ts'],
          environment: 'node',
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
})
