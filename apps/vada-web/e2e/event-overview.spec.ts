import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const OVERVIEW = '/#/EVT-02?eventId=E-01'

// 갈피 줄은 셸의 메뉴와 이름이 겹친다(재정·업무). 작업 공간 안에서만 찾는다.
const tabs = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: /행사를 여는 화면들/ })

// EVT-02는 행사 작업 공간의 **두 번째** 화면이다. 갈피 줄·상태 줄·제목은 이 화면의
// 것이 아니라 shell.json의 작업 공간 것이고, 화면은 어디에 그리는지만 안다.

test('EVT-02: 행사 인자로 그 행사의 개요를 연다', async ({ page }) => {
  await page.goto(OVERVIEW)

  await expect(
    page.getByRole('heading', { level: 1, name: '2026 소프트웨어융합대학 체육대회' }),
  ).toBeVisible()
  await expect(page.getByText(/모집 마감까지 3일 남았습니다\. 정원 200명/)).toBeVisible()
  await expect(page.getByText('카카오톡 채널 @swcollege')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/evt-02.png`, fullPage: true })
})

test('EVT-02: 인자가 없으면 아무 행사나 보여주지 않고 드러낸다', async ({ page }) => {
  await page.goto('/#/EVT-02')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-02', 'eventId'))
  await expect(page.getByText('카카오톡 채널 @swcollege')).toBeHidden()
})

// 같은 머리를 두 화면이 나눠 쓴다는 것이 이번 사이클의 핵심이다.
test('EVT-02: 갈피를 옮기면 같은 행사의 다른 화면으로 간다', async ({ page }) => {
  await page.goto(OVERVIEW)

  await tabs(page).getByRole('button', { name: '업무', exact: true }).click()

  // 어느 행사인지가 함께 간다 — 갈피를 옮겼다고 다른 행사가 되지 않는다.
  await expect(page).toHaveURL(/#\/EVT-TASK-01\?eventId=E-01/)
  await expect(page.getByRole('heading', { name: '행사 업무 — 칸반 보드' })).toBeVisible()

  // 돌아와도 마찬가지다.
  await tabs(page).getByRole('button', { name: '개요', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-02\?eventId=E-01/)
})

test('EVT-02: 두 화면의 상태 줄이 같은 값을 그린다', async ({ page }) => {
  await page.goto(OVERVIEW)
  await expect(page.getByText('담당 학술체육부 · 김바다')).toBeVisible()
  await expect(page.getByText('주의 · 지연 업무 1건')).toBeVisible()

  await page.goto('/#/EVT-TASK-01?eventId=E-01')
  await expect(page.getByText('담당 학술체육부 · 김바다')).toBeVisible()
  await expect(page.getByText('주의 · 지연 업무 1건')).toBeVisible()
})

test('EVT-02: 강조 카드는 업무 보드로 이어진다', async ({ page }) => {
  await page.goto(OVERVIEW)

  await page.getByRole('button', { name: /담당자 없는 업무 2건/ }).click()

  await expect(page).toHaveURL(/#\/EVT-TASK-01\?eventId=E-01/)
})

test('EVT-02: 확인해야 할 항목은 갈 곳이 있는 것만 문구를 갖는다', async ({ page }) => {
  await page.goto(OVERVIEW)

  await expect(page.getByRole('button', { name: '참가자 명단 보기 →' })).toBeVisible()
  await expect(page.getByRole('button', { name: '업무 보기 →' })).toBeVisible()
  // 갈 곳이 없는 항목에는 문구가 오지 않는다.
  await expect(page.getByText('QR 참석 확인 설정 완료')).toBeVisible()
  await expect(page.getByRole('button', { name: /QR/ })).toHaveCount(0)

  // 항목마다 가는 곳이 다른데 그것을 적을 자리가 아직 없다.
  await page.getByRole('button', { name: '업무 보기 →' }).click()
  await expect(page.getByText(/항목마다 가는 곳이 다른데/)).toBeVisible()
})
