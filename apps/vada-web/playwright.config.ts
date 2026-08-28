import { defineConfig } from '@playwright/test'

// 시나리오 검증 러너: AI가 직접 브라우저를 구동해 스크린샷을 찍고 대조한다.
// 뷰포트 1472는 reference.png(1288×0.875 스케일)의 원본 상당 폭이라
// 카드 비율이 레퍼런스와 같은 조건으로 찍힌다.
// 개발 서버는 화면을 열 때마다 모듈 2,700개를 따로 내준다. 검사는 화면을 176번
// 여는 일이라 그 값이 통째로 곱해진다. E2E_PREVIEW=1이면 빌드된 묶음을 대신 친다.
// 빌드는 한 번이고 여는 것은 176번이므로 이쪽이 싸다.
const preview = process.env.E2E_PREVIEW === '1'
const baseURL = preview ? 'http://localhost:4173' : 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // 검사끼리 아무것도 나눠 쓰지 않는다 - 모든 검사가 제 page.goto로 시작하고
  // 픽스처는 고정이다. 그래서 파일 단위가 아니라 **검사 단위**로 갈라도 된다.
  // 파일이 11개짜리부터 1개짜리까지 고르지 않아 파일 단위로는 일꾼이 논다.
  fullyParallel: true,
  use: {
    baseURL,
    viewport: { width: 1472, height: 846 },
  },
  webServer: {
    command: preview ? 'npm run preview -- --port 4173 --strictPort' : 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
