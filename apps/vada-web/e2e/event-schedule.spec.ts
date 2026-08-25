import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const SCHEDULE = '/#/EVT-SCHED-01?eventId=E-01'

// 갈피 줄은 셸의 메뉴와 이름이 겹친다(재정·업무). 작업 공간 안에서만 찾는다.
const tabs = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: /행사를 여는 화면들/ })

// '참가자 모집 공지 작성'은 상태 줄의 '다음 일정'에도 그려진다. 목록 안에서만 찾는다.
const timeline = (page: import('@playwright/test').Page) =>
  page.locator('[data-node-id="28:161"]')

// EVT-SCHED-01은 행사 작업 공간의 **다섯 번째** 화면이다.

test('EVT-SCHED-01: 행사 인자로 그 행사의 일정만 본다', async ({ page }) => {
  await page.goto(SCHEDULE)

  await expect(
    page.getByRole('heading', { level: 1, name: '2026 소프트웨어융합대학 체육대회' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: '행사 일정' })).toBeVisible()
  await expect(timeline(page).getByText('참가자 모집 공지 작성')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/evt-sched-01.png`, fullPage: true })
})

test('EVT-SCHED-01: 인자가 없으면 아무 행사의 일정이나 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-SCHED-01')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-SCHED-01', 'eventId'))
  await expect(timeline(page)).toBeHidden()
})

test('EVT-SCHED-01: 갈피 다섯이 같은 행사를 이어 간다', async ({ page }) => {
  await page.goto(SCHEDULE)

  await tabs(page).getByRole('button', { name: '관련 회의', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-MEET-01\?eventId=E-01/)

  await tabs(page).getByRole('button', { name: '일정', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-SCHED-01\?eventId=E-01/)
  await expect(page.getByText('담당 학술체육부 · 김바다')).toBeVisible()
})

// 좁혀 보기는 EVT-DOC-01의 필터에서 개수만 빠진 것이다. 거르는 것은 서버이지
// 화면이 아니므로, 고르면 목록이 줄어드는 것으로 확인한다.
test('EVT-SCHED-01: 좁혀 보면 그 묶음의 일정만 남는다', async ({ page }) => {
  await page.goto(SCHEDULE)

  await expect(page.getByText('참여 설문 마감')).toBeVisible()
  await expect(page.getByText('안전 관리 최종 회의')).toBeVisible()

  await page.getByRole('radio', { name: '마감' }).click()
  await expect(page.getByText('참여 설문 마감')).toBeVisible()
  await expect(page.getByText('안전 관리 최종 회의')).toBeHidden()

  await page.getByRole('radio', { name: '회의' }).click()
  await expect(page.getByText('안전 관리 최종 회의')).toBeVisible()
  await expect(page.getByText('참여 설문 마감')).toBeHidden()
})

// 이 화면의 요점이다. 줄마다 어디가 원본인지 말하고, 아래는 어디서 고치는지 말한다.
test('EVT-SCHED-01: 줄마다 원본이 어디인지 말한다', async ({ page }) => {
  await page.goto(SCHEDULE)

  await expect(page.getByText('원본 · 참여 설문')).toBeVisible()
  await expect(page.getByText('원본 · 관련 회의')).toBeVisible()
  await expect(page.getByText('원본 · 행사 기본정보')).toBeVisible()
  await expect(page.getByText(/일정은 여기서 중복 수정하지 않습니다/)).toBeVisible()
})

test('EVT-SCHED-01: 날짜가 없는 일정도 그 사실대로 온다', async ({ page }) => {
  await page.goto(SCHEDULE)

  await expect(page.getByText('행사 후')).toBeVisible()
  await expect(page.getByText('결과 보고·정산 자료 정리')).toBeVisible()
})

test('EVT-SCHED-01: 아직 없는 화면으로 가는 두 자리를 남긴다', async ({ page }) => {
  await page.goto(SCHEDULE)

  await page.getByRole('button', { name: '전체 캘린더 보기' }).click()
  await expect(page.getByText(/전체 캘린더 화면이 아직 명세되지 않았습니다/)).toBeVisible()

  await page.getByRole('button', { name: /참가자 모집 공지 작성 일정 원본 열기/ }).click()
  await expect(page.getByText(/일정의 원본을 여는 화면이 아직 명세되지 않았습니다/)).toBeVisible()
})
