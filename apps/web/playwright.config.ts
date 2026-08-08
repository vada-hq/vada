import { defineConfig, devices } from "@playwright/test";

/**
 * 진짜 브라우저에서 보는 검사.
 *
 * jsdom에는 레이아웃 엔진이 없다. CSS Grid를 계산하지 않고, z-index도 히트
 * 테스트도 없다. 그래서 `user.click()`은 가려진 요소에도 항상 성공하고,
 * 나란한 두 입력칸의 높이가 어긋나도 통과한다. 실제로 그렇게 통과한 화면을
 * 사람이 열었더니 드롭다운이 안 열렸다.
 *
 * 목 서버로 돌린다. 여기서 잡으려는 것은 레이아웃·상호작용·브라우저 입력
 * 규칙이고, 그건 전부 화면 쪽 사실이라 데이터베이스가 필요 없다. 서버 쪽
 * 사실은 pytest가 실제 PostgreSQL로 본다.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:5199",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // 호스트를 못 박는다. 기본값은 localhost로 열리는데 Windows에서는 그것이
    // ::1로 먼저 풀려 127.0.0.1을 기다리는 쪽이 영원히 기다린다.
    command: "pnpm vite --mode mock --host 127.0.0.1 --port 5199 --strictPort",
    url: "http://127.0.0.1:5199",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 120_000,
  },
});
