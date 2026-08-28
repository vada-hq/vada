import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const PARTICIPANTS = '/#/EVT-04?eventId=E-01'

// 갈피 줄은 셸의 메뉴와 이름이 겹친다(재정·업무). 작업 공간 안에서만 찾는다.
const tabs = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: /행사를 여는 화면들/ })

const table = (page: import('@playwright/test').Page) =>
  page.locator('[data-node-id="20:7707"]')

// EVT-04는 행사 작업 공간의 **여섯 번째** 화면이다.

test('EVT-04: 행사 인자로 그 행사의 참가자만 본다', async ({ page }) => {
  await page.goto(PARTICIPANTS)

  await expect(
    page.getByRole('heading', { level: 1, name: '2026 소프트웨어융합대학 체육대회' }),
  ).toBeVisible()
  await expect(table(page).getByText('김학생')).toBeVisible()
  await expect(page.getByText('총 6명')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/evt-04.png`, fullPage: true })
})

test('EVT-04: 인자가 없으면 아무 행사의 참가자나 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-04')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-04', 'eventId'))
  await expect(table(page)).toBeHidden()
})

test('EVT-04: 갈피 여섯이 같은 행사를 이어 간다', async ({ page }) => {
  await page.goto(PARTICIPANTS)

  await tabs(page).getByRole('button', { name: '일정', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-SCHED-01\?eventId=E-01/)

  await tabs(page).getByRole('button', { name: '인원 관리', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-04\?eventId=E-01/)
  await expect(page.getByText('담당 학술체육부 · 김바다')).toBeVisible()
})

// 다른 다섯 화면은 이 자리에 '행사 관리 행동은 담당 운영진에게 제공됩니다'를 그린다.
// 행동이 있으면 그 안내가 설 자리가 없다 — 안내는 행동이 없다는 말이기 때문이다.
test('EVT-04: 상태 줄에 안내 대신 행동이 온다', async ({ page }) => {
  await page.goto(PARTICIPANTS)

  await expect(page.getByRole('button', { name: '행사 시작' })).toBeVisible()
  await expect(page.getByText('행사 관리 행동은 담당 운영진에게 제공됩니다.')).toBeHidden()

  await page.goto('/#/EVT-SCHED-01?eventId=E-01')
  await expect(page.getByText('행사 관리 행동은 담당 운영진에게 제공됩니다.')).toBeVisible()
})

test('EVT-04: 이름·학번으로 좁히면 그 줄만 남는다', async ({ page }) => {
  await page.goto(PARTICIPANTS)

  await page.getByRole('searchbox', { name: '이름, 학번 검색' }).fill('이수강')
  await expect(table(page).getByText('이수강')).toBeVisible()
  await expect(table(page).getByText('김학생')).toBeHidden()
  await expect(page.getByText('총 1명')).toBeVisible()
})

// 디자인에 라벨도 선택지도 없는 빈 네모 넷이다. 무엇으로 거르는지는 명세가,
// 무엇을 고를 수 있는지는 서버가 안다.
test('EVT-04: 거르기는 서버가 준 선택지로 한다', async ({ page }) => {
  await page.goto(PARTICIPANTS)

  await page.getByRole('combobox', { name: '입금 상태' }).click()
  await page.getByRole('option', { name: '미납' }).click()

  await expect(table(page).getByText('이수강')).toBeVisible()
  await expect(table(page).getByText('김학생')).toBeHidden()
  await expect(page.getByText('총 1명')).toBeVisible()
})

test('EVT-04: 고른 참가자에게 할 일이 아직 없다는 사실을 남긴다', async ({ page }) => {
  await page.goto(PARTICIPANTS)

  await page.getByRole('checkbox', { name: '김학생 고르기' }).check()
  await page.getByRole('button', { name: /고른 참가자에게 1명/ }).click()
  await expect(
    page.getByText(/고른 참가자에게 할 수 있는 일이 아직 명세되지 않았습니다/),
  ).toBeVisible()
})

// 하위 갈피 줄은 **고르는 값이 아니라 옮겨 가는 것이다.** 갈피마다 다른 화면이라
// 사람이 그 사이를 오갈 수 있다 - select로 두면 이 화면이 저쪽의 조직도를 자기가
// 그려야 하고 그것이 조용한 대체다.
test('EVT-04: 인원 관리 안의 갈피 줄은 운영 조직 화면으로 이어진다', async ({
  page,
}) => {
  await page.goto(PARTICIPANTS)

  await expect(
    page.getByRole('button', { name: '행사 참가자', exact: true }),
  ).toBeDisabled()

  await page.getByRole('button', { name: '운영 조직', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-03A\?eventId=E-01/)
})

test('EVT-04: 머리의 행동 셋이 아직 없는 화면임을 남긴다', async ({ page }) => {
  await page.goto(PARTICIPANTS)

  await page.getByRole('button', { name: '참석 확인 QR' }).click()
  await expect(page.getByText(/참석 확인 QR 화면이 아직 명세되지 않았습니다/)).toBeVisible()
})
