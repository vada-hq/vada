import { defineConfig } from '@playwright/test'

// 시나리오 검증 러너: AI가 직접 브라우저를 구동해 스크린샷을 찍고 대조한다.
// 뷰포트 1472는 reference.png(1288×0.875 스케일)의 원본 상당 폭이라
// 카드 비율이 레퍼런스와 같은 조건으로 찍힌다.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1472, height: 846 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
