import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'
const DETAIL = '/#/FIN-REQ-02?requestId=PR-2026-0031'

test('FIN-REQ-02: 요청 상세와 현재 진행 단계를 함께 보여준다', async ({ page }) => {
  await page.goto(DETAIL)

  await expect(
    page.getByRole('heading', { level: 1, name: '구매 요청 상세·진행 상태' }),
  ).toBeVisible()
  const breadcrumb = page.getByRole('navigation', { name: '현재 위치' })
  await expect(breadcrumb.getByText('내 구매 요청', { exact: true })).toBeVisible()
  await expect(breadcrumb.getByText('REQ-001', { exact: true })).toBeVisible()

  const steps = page.locator('[data-node-id="30:929"]')
  await expect(steps.getByText('요청 제출', { exact: true })).toBeVisible()
  await expect(steps.getByText('재정부 검토', { exact: true })).toHaveAttribute(
    'aria-current',
    'step',
  )

  const summary = page.locator('[data-node-id="30:960"]')
  await expect(summary.getByText('REQ-001', { exact: true })).toBeVisible()
  await expect(summary.getByText('보완 요청', { exact: true })).toBeVisible()
  await expect(summary.getByText('135,000원', { exact: true })).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/fin-req-02.png`, fullPage: true })
})

test('FIN-REQ-02: 품목 처리 결과와 기록을 서버 순서대로 보여준다', async ({ page }) => {
  await page.goto(DETAIL)

  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader', { name: '재정부 전달사항' })).toBeVisible()
  await expect(table.getByRole('row')).toHaveCount(5)
  await expect(table.getByText('박스테이프', { exact: true })).toBeVisible()
  await expect(table.getByText('이름표 용지', { exact: true })).toBeVisible()

  const history = page.locator('[data-node-id="30:1038"]')
  await expect(history.getByText('제출', { exact: true })).toBeVisible()
  await expect(history.getByText('보완 요청 발송', { exact: true })).toBeVisible()
})

test('FIN-REQ-02: 보완 확인의 다음 화면이 아직 없음을 드러낸다', async ({ page }) => {
  await page.goto(DETAIL)

  await page.getByRole('button', { name: '보완 내용 확인' }).click()
  await expect(page.getByRole('alert')).toContainText(
    '보완 요청을 확인하고 다시 제출하는 화면이 아직 명세되지 않았습니다.',
  )
})

test('FIN-REQ-02: 요청 id가 없으면 아무 요청이나 대신 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/FIN-REQ-02')

  await expect(page.getByRole('alert')).toContainText('requestId')
  await expect(page.getByText('REQ-001', { exact: true })).toHaveCount(0)
})
