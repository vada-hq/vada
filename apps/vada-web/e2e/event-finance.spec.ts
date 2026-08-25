import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const FINANCE = '/#/EVT-FIN-01?eventId=E-01'

// 갈피 줄은 셸의 메뉴와 이름이 겹친다(재정·업무). 작업 공간 안에서만 찾는다.
const tabs = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: /행사를 여는 화면들/ })

// EVT-FIN-01은 행사 작업 공간의 **일곱 번째이자 마지막** 화면이다.

test('EVT-FIN-01: 행사 인자로 그 행사의 재정을 연다', async ({ page }) => {
  await page.goto(FINANCE)

  await expect(
    page.getByRole('heading', { level: 1, name: '행사 재정 — 개요' }),
  ).toBeVisible()
  await expect(page.getByText('3,000,000')).toBeVisible()
  await expect(page.getByText('체육대회 운영 물품 4종')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/evt-fin-01.png`, fullPage: true })
})

test('EVT-FIN-01: 인자가 없으면 아무 행사의 재정이나 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-FIN-01')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-FIN-01', 'eventId'))
  await expect(page.getByText('3,000,000')).toBeHidden()
})

// 마지막 갈피가 찼다 — 일곱이 전부 화면을 가리킨다.
test('EVT-FIN-01: 갈피 일곱이 전부 이어진다', async ({ page }) => {
  await page.goto(FINANCE)

  for (const [label, id] of [
    ['개요', 'EVT-02'],
    ['업무', 'EVT-TASK-01'],
    ['문서', 'EVT-DOC-01'],
    ['관련 회의', 'EVT-MEET-01'],
    ['일정', 'EVT-SCHED-01'],
    ['인원 관리', 'EVT-04'],
    ['재정', 'EVT-FIN-01'],
  ] as const) {
    await tabs(page).getByRole('button', { name: label, exact: true }).click()
    await expect(page).toHaveURL(`/#/${id}?eventId=E-01`)
  }
})

// 배정에서 무엇을 빼야 사용 가능액이 되는지는 재정 규칙이다. 화면은 빼지 않는다.
test('EVT-FIN-01: 금액 넷이 저마다 서버에서 온다', async ({ page }) => {
  await page.goto(FINANCE)

  await expect(page.getByText('배정 예산')).toBeVisible()
  await expect(page.getByText('승인·집행 예정액')).toBeVisible()
  await expect(page.getByText('실제 지출액')).toBeVisible()
  await expect(page.getByText('사용 가능액')).toBeVisible()
  await expect(page.getByText('1,100,000')).toBeVisible()
})

test('EVT-FIN-01: 열 넷 중 빈 열은 비어 있다고 말한다', async ({ page }) => {
  await page.goto(FINANCE)

  await expect(page.getByText('검토 필요')).toBeVisible()
  await expect(page.getByText('현수막 A형 제작')).toBeVisible()
  // 구매·증빙·정산 세 열이 비어 있다.
  await expect(page.getByText('항목 없음')).toHaveCount(3)
})

test('EVT-FIN-01: 재정 갈피 둘 중 하나는 아직 없다', async ({ page }) => {
  await page.goto(FINANCE)

  await page.getByRole('tab', { name: '전체 목록' }).click()
  await expect(page.getByText(/이 갈피의 내용은 아직 명세되지 않았습니다/)).toBeVisible()
})

// 새 구매 요청이 이어지는 것은 purchase-request.spec.ts가 본다 — 그 화면의 일이다.
test('EVT-FIN-01: 카드를 누르면 그 요청의 상세로 간다', async ({ page }) => {
  await page.goto(FINANCE)

  await page.getByRole('button', { name: /체육대회 운영 물품 4종 구매 요청 열기/ }).click()

  // 어느 요청인지는 눌린 카드가 정한다. 아무 요청이나 열리면 안 된다.
  await expect(page).toHaveURL(/#\/FIN-REQ-02\?requestId=PR-2026-0031/)
  await expect(page.getByRole('heading', { name: '구매 요청 상세·진행 상태' })).toBeVisible()
  await expect(page.getByText('REQ-001').first()).toBeVisible()
})
