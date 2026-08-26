import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const PROCESSING = '/#/FIN-PROC-01?requestId=PR-2026-0031'

test('FIN-PROC-01: 승인된 요청과 업체별 발주 상태를 함께 보여준다', async ({ page }) => {
  await page.goto(PROCESSING)

  await expect(page.getByRole('heading', { level: 1, name: '구매·발주 처리' })).toBeVisible()
  const breadcrumb = page.getByRole('navigation', { name: '현재 위치' })
  await expect(breadcrumb.getByText('2026 소프트웨어융합대학 체육대회')).toBeVisible()

  const summary = page.locator('[data-node-id="30:1660"]')
  await expect(summary.getByText('REQ-001', { exact: true })).toBeVisible()
  await expect(summary.getByText('구매 진행 중', { exact: true })).toBeVisible()
  await expect(summary.getByText('135,000원', { exact: true })).toBeVisible()

  await expect(page.getByRole('table')).toHaveCount(3)
  const firstOrder = page.locator('[data-node-id="30:1677"]')
  await expect(firstOrder.getByText('다이소 온라인몰', { exact: true })).toBeVisible()
  await expect(firstOrder.getByText('박스테이프', { exact: true })).toBeVisible()
  await expect(page.getByText('인쇄업체 A (제작 발주)', { exact: true })).toBeVisible()
  await expect(page.getByText('품절·변경 필요', { exact: true })).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/fin-proc-01.png`, fullPage: true })
})

test('FIN-PROC-01: 아직 명세되지 않은 다음 단계 동작을 명시한다', async ({ page }) => {
  await page.goto(PROCESSING)

  await page.getByRole('button', { name: '결제·증빙 단계로 이동' }).click()
  await expect(page.getByRole('alert')).toContainText(
    '결제·증빙을 정리하는 화면이 아직 명세되지 않았습니다. 이 버튼이 단계를 옮기는 일까지 하는지도 정해지지 않았습니다.',
  )
})

test('FIN-PROC-01: 요청 id가 없으면 아무 요청이나 대신 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/FIN-PROC-01')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('FIN-PROC-01', 'requestId'))
  await expect(page.getByText('REQ-001', { exact: true })).toHaveCount(0)
})
