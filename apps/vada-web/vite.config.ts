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
          // 워커 둘로 되돌렸다(2026-08-25).
          //
          // 하나로 줄였던 이유는 "격리를 푼 환경을 워커 둘이 나눠 쓰면 수명이
          // 엇갈려 파일이 수집도 되기 전에 전부 죽는다"였다. 그 진단은 절반이
          // 틀렸다 — 진짜 원인은 dom과 node가 **같은 풀을 물려받는 것**이었고,
          // 아래 node 프로젝트의 pool:'threads'가 그것을 갈랐다.
          //
          // "속도 손해도 거의 없다"고 적은 것도 틀렸다. 화면이 늘면서 dom 파일
          // 열둘을 줄줄이 도는 값이 커졌다. 실측: 워커 1은 54초, 워커 2는 20초.
          // 전체 게이트가 69.5초로 시간 예산(60초)을 넘겨 실패하던 것이 여기서
          // 풀렸다 — 검사를 지우지 않고.
          //
          // 되돌리기 전에 전체 게이트를 7회 연속 돌려 175개가 전부 통과하는
          // 것을 봤다. **그래도 증명은 아니다** — 원래 드물게 나던 결함이다.
          // 다시 나면(dom은 "Vitest failed to find the current suite", node는
          // "Cannot read properties of undefined") 이 줄부터 의심할 것.
          maxWorkers: 2,
          // 두 프로젝트가 워커 수가 다르면 순서 묶음을 갈라야 한다(vitest가
          // 요구한다).
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/*.test.ts'],
          environment: 'node',
          // **풀을 갈라 둔다.** groupOrder는 순서만 가르지 프로세스를 가르지
          // 않는다 — dom이 끝난 뒤 그 fork를 node가 물려받을 수 있다.
          //
          // 위에서 dom의 격리를 풀었으므로(isolate:false) setup은 파일마다가
          // 아니라 **워커마다 한 번** 돈다. 그 워커가 수집 문맥이 닫힌 뒤에
          // 재활용되면 setup의 afterEach가 문맥 밖에서 걸리고, 그 순간 파일
          // 열넷이 하나도 못 돌고 죽는다 — `.test-flakes.log`에 쌓인 세 번이
          // 전부 그 모양이다(dom은 "Vitest failed to find the current suite",
          // node는 "Cannot read properties of undefined (reading 'config')").
          //
          // 이 파일들은 순수 로직이라 jsdom을 쌓지 않는다. 스레드가 "Worker
          // exited unexpectedly"로 죽던 경로는 jsdom 쪽이었으므로 여기는 안전하다.
          //
          // **아직 고쳤다고 말하지 않는다.** 세 번뿐인 일이라 통과 한 번으로는
          // 증명되지 않는다. 다시 나면 이 줄부터 의심할 것.
          pool: 'threads',
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
})
