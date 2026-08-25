import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const MEETINGS = '/#/EVT-MEET-01?eventId=E-01'

// 갈피 줄은 셸의 메뉴와 이름이 겹친다(재정·업무). 작업 공간 안에서만 찾는다.
const tabs = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: /행사를 여는 화면들/ })

// EVT-MEET-01은 행사 작업 공간의 **네 번째** 화면이다.

test('EVT-MEET-01: 행사 인자로 그 행사에 연결된 회의만 본다', async ({ page }) => {
  await page.goto(MEETINGS)

  await expect(
    page.getByRole('heading', { level: 1, name: '2026 소프트웨어융합대학 체육대회' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: '관련 회의' })).toBeVisible()
  await expect(page.getByText('체육대회 운영 점검 회의')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/evt-meet-01.png`, fullPage: true })
})

test('EVT-MEET-01: 인자가 없으면 아무 행사의 회의나 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-MEET-01')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-MEET-01', 'eventId'))
  await expect(page.getByText('체육대회 운영 점검 회의')).toBeHidden()
})

test('EVT-MEET-01: 갈피 넷이 같은 행사를 이어 간다', async ({ page }) => {
  await page.goto(MEETINGS)

  await tabs(page).getByRole('button', { name: '문서', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-DOC-01\?eventId=E-01/)

  await tabs(page).getByRole('button', { name: '관련 회의', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-MEET-01\?eventId=E-01/)
  await expect(page.getByText('담당 학술체육부 · 김바다')).toBeVisible()
})

// 공간 밖으로 나가는 첫 이동이다. 회의 목록은 행사에 매이지 않으므로 인자가 없다.
test('EVT-MEET-01: 전체 회의 보기는 공간 밖의 회의 목록으로 나간다', async ({ page }) => {
  await page.goto(MEETINGS)

  await page.getByRole('button', { name: '전체 회의 보기' }).click()

  await expect(page).toHaveURL(/#\/OPS-MEET-01A$/)
  await expect(page.getByRole('heading', { level: 1, name: '회의' })).toBeVisible()
})

test('EVT-MEET-01: 세는 말은 회의마다 다르게 온다', async ({ page }) => {
  await page.goto(MEETINGS)

  await expect(page.getByText('참가 8명')).toBeVisible()
  await expect(page.getByText('참가 예정 4명')).toBeVisible()
  await expect(page.getByText('참석 6명')).toBeVisible()
})

test('EVT-MEET-01: 회의를 여는 화면이 없다는 사실을 남긴다', async ({ page }) => {
  await page.goto(MEETINGS)

  await page.getByRole('button', { name: /체육대회 운영 점검 회의 회의 상세 보기/ }).click()
  await expect(page.getByText(/회의를 여는 화면이 아직 명세되지 않았습니다/)).toBeVisible()
})
