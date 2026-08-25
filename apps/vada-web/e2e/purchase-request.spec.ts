import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const EDIT = '/#/FIN-REQ-01?eventId=E-01&requestId=PR-2026-0031'
const NEW = '/#/FIN-REQ-01?eventId=E-01'

// FIN-REQ-01은 **행사 화면 일곱을 지나 처음으로 값을 쓰고 보내는 화면**이다.
// 그리고 한 화면이 두 모드를 겸하는 첫 사례다 — 요청 id가 있으면 고치고, 없으면
// 새로 쓴다.

test('FIN-REQ-01: 요청 id가 있으면 그 요청을 읽어 채운다', async ({ page }) => {
  await page.goto(EDIT)

  await expect(
    page.getByRole('heading', { level: 1, name: '구매 요청 작성·수정' }),
  ).toBeVisible()
  await expect(page.getByRole('textbox', { name: '요청 제목*' })).toHaveValue(
    '체육대회 운영 물품',
  )
  // 품목 넷이 저마다 다른 값으로 온다. 명세가 적은 것은 그 틀 하나다.
  await expect(page.getByRole('textbox', { name: '품목명*' })).toHaveCount(4)
  await page.screenshot({ path: `${SHOTS}/fin-req-01.png`, fullPage: true })
})

test('FIN-REQ-01: 요청 id가 없어도 열린다 — 그것이 새로 쓰는 것이다', async ({ page }) => {
  await page.goto(NEW)

  // 없어도 되는 인자라 화면이 막아서지 않는다.
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: '요청 제목*' })).toHaveValue('')
  // 빈 요청에도 품목 한 줄은 있다(minItems).
  await expect(page.getByRole('textbox', { name: '품목명*' })).toHaveCount(1)
  // 그런데 요청 부서는 비어 있지 않다 — 서버가 이미 아는 값이다.
  await expect(page.getByRole('textbox', { name: '요청 부서' })).toHaveValue('운영부')
})

test('FIN-REQ-01: 어느 행사인지가 없으면 열리지 않는다', async ({ page }) => {
  await page.goto('/#/FIN-REQ-01')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('FIN-REQ-01', 'eventId'))
  await expect(page.getByRole('textbox', { name: '요청 제목*' })).toHaveCount(0)
})

// 이 화면의 핵심이다. EVT-FIN-01에서는 금액이 서버가 보낸 글이었다.
test('FIN-REQ-01: 금액을 화면이 셈한다', async ({ page }) => {
  await page.goto(EDIT)

  // 5 × 2000 = 10,000
  await expect(page.getByText('10,000원')).toBeVisible()
  // 10×5000 + 5×2000 + 200×300 + 10×1500 = 135,000
  await expect(page.getByText('135,000')).toBeVisible()

  const quantity = page.getByRole('spinbutton', { name: '수량*' }).first()
  await quantity.fill('6')

  // 사람이 고친 순간 다시 셈한다 — 서버에 물어볼 것이 없다.
  await expect(page.getByText('12,000원')).toBeVisible()
  await expect(page.getByText('137,000')).toBeVisible()
})

test('FIN-REQ-01: 품목을 더하면 개수도 합계도 따라 바뀐다', async ({ page }) => {
  await page.goto(EDIT)

  await expect(page.getByText('총 4개 품목')).toBeVisible()
  await expect(page.getByText('4개', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '품목 추가' }).click()

  await expect(page.getByText('총 5개 품목')).toBeVisible()
  await expect(page.getByRole('textbox', { name: '품목명*' })).toHaveCount(5)
  // 빈 품목은 합계를 바꾸지 않는다 — 수로 읽히지 않는 값은 셈에서 빠진다.
  await expect(page.getByText('135,000')).toBeVisible()
})

test('FIN-REQ-01: 요약은 폼의 값을 되비춘다', async ({ page }) => {
  await page.goto(EDIT)

  // 같은 값이 폼과 요약 두 자리에 나온다 — 되비춘다는 것이 그 뜻이다.
  const summary = page.locator('[data-node-id="30:776"]')
  await expect(summary.getByText('보통')).toBeVisible()
  await expect(summary.getByText('2026-08-12')).toBeVisible()

  await page.getByLabel('필요한 날짜*').fill('2026-09-01')
  await expect(summary.getByText('2026-09-01')).toBeVisible()
})

test('FIN-REQ-01: 요청 부서는 보여주되 고칠 수 없다', async ({ page }) => {
  await page.goto(EDIT)

  const department = page.getByRole('textbox', { name: '요청 부서' })
  await expect(department).toHaveValue('운영부')
  await expect(department).toHaveAttribute('readonly', '')
  await expect(page.getByText('작성자의 소속 부서로 고정됩니다.')).toBeVisible()
})

test('FIN-REQ-01: 제출하면 재정 개요로 돌아간다', async ({ page }) => {
  await page.goto(EDIT)

  await page.getByRole('button', { name: '구매 요청 제출' }).click()

  await expect(page).toHaveURL('/#/EVT-FIN-01?eventId=E-01')
})

test('FIN-REQ-01: 취소하면 어디로 가는지가 아직 없다', async ({ page }) => {
  await page.goto(EDIT)

  await page.getByRole('button', { name: '취소' }).click()

  await expect(page.getByText(/취소하면 어디로 가는지가 디자인에 없습니다/)).toBeVisible()
})

// 재정 개요의 카드마다 pending이던 자리 하나가 이제 이어진다.
test('EVT-FIN-01: 새 구매 요청이 이 화면으로 이어진다', async ({ page }) => {
  await page.goto('/#/EVT-FIN-01?eventId=E-01')

  await page.getByRole('button', { name: '새 구매 요청' }).click()

  await expect(page).toHaveURL('/#/FIN-REQ-01?eventId=E-01')
  await expect(page.getByRole('heading', { name: '구매 요청서 작성' })).toBeVisible()
})
