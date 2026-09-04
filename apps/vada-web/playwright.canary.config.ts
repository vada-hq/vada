import { defineConfig } from '@playwright/test'

// 카나리만 도는 자리. 까닭은 `scripts/ship-canary-server.mjs`에 있다.
//
// **기존 e2e와 겹치지 않는다.** 저쪽은 개발용 응답으로 만든 `dist-e2e/`를 보고
// 명세가 말한 것을 화면이 그리는가를 잰다. 여기는 **나가는 `dist/`**를 진짜
// 저장소에 붙여 놓고 사람이 여는 그대로 연다.

const PORT = 4180

export default defineConfig({
  testDir: './e2e-ship',
  // **다시 돌리지 않는다.** 흔들림을 감추면 카나리가 카나리가 아니다.
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // 실패하면 무엇이 그려졌는지가 곧 단서다.
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node ../../scripts/ship-canary-server.mjs`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    // PGlite를 세우고 표를 만드는 데 시간이 든다.
    timeout: 90_000,
    env: { CANARY_PORT: String(PORT) },
  },
})
