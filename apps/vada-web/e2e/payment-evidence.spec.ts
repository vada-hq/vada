import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const EVIDENCE = '/#/FIN-EVID-01?requestId=PR-2026-0031'

test('FIN-EVID-01: 승인 금액과 실결제 합계를 나란히 놓는다', async ({ page }) => {
  await page.goto(EVIDENCE)

  // 둘이 다를 수 있다는 것이 이 단계의 물음이다. 실결제가 2,500원 많다.
  const head = page.locator('[data-node-id="30:1865"]')
  await expect(head.getByText('135,000원', { exact: true })).toBeVisible()
  await expect(head.getByText('137,500원', { exact: true })).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/fin-evid-01.png`, fullPage: true })
})

test('FIN-EVID-01: 결제마다 연결된 품목과 증빙 서류가 함께 온다', async ({ page }) => {
  await page.goto(EVIDENCE)

  // 안쪽 목록 둘은 조회하지 않는다. 그 결제의 일부이지 따로 있는 것이 아니다.
  const first = page.locator('[data-node-id="30:1887"]')
  await expect(first.getByText('다이소 온라인몰', { exact: true })).toBeVisible()
  await expect(first.getByText('박스테이프', { exact: true })).toBeVisible()
  await expect(first.getByText('유성 마커', { exact: true })).toBeVisible()
  await expect(first.getByText('영수증', { exact: true })).toBeVisible()

  // 결제 셋이 다 그려진다. 되풀이되는 것은 자리가 아니라 틀이다.
  await expect(page.getByText('마켓컬리 B2B', { exact: true })).toBeVisible()
  await expect(page.getByText('인쇄업체 A', { exact: true })).toBeVisible()
})

test('FIN-EVID-01: 승인액과 다른 결제만 차이를 밝힌다', async ({ page }) => {
  await page.goto(EVIDENCE)

  await expect(page.getByText('실결제액이 승인액보다 500원 적음')).toBeVisible()
  await expect(page.getByText('견적서 대비 최종 납품가 3,000원 초과')).toBeVisible()
  // 마켓컬리는 승인액과 같으므로 차액 문구가 오지 않는다. 없는 것을 그리지 않는다.
  await expect(page.getByText(/승인 50,000원 → 실결제 50,000원/)).toBeVisible()
})

test('FIN-EVID-01: 끝낼 수 있는지는 서버가 말한다', async ({ page }) => {
  await page.goto(EVIDENCE)

  // 증빙 둘이 비어 있다. 무엇이 '다 됐다'인지는 조직의 규칙이라 화면이 세지 않는다.
  await page.getByRole('button', { name: '처리 완료' }).click()

  await expect(page.getByRole('alert')).toContainText(
    '증빙 서류 2건이 아직 등록되지 않았습니다.',
  )
  await expect(page).toHaveURL(/#\/FIN-EVID-01/)
})

test('FIN-EVID-01: 파일을 올리는 자리는 아직 없다', async ({ page }) => {
  await page.goto(EVIDENCE)

  await page.getByRole('button', { name: '파일 추가' }).first().click()

  await expect(page.getByRole('alert')).toContainText('파일을 올리는 자리가 아직 명세되지 않았습니다')
})

test('FIN-EVID-01: 요청 id가 없으면 아무 요청이나 대신 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/FIN-EVID-01')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('FIN-EVID-01', 'requestId'))
  await expect(page.getByText('다이소 온라인몰', { exact: true })).toBeHidden()
})

test('FIN-PROC-01: 결제·증빙 단계로 이동이 이 화면으로 이어진다', async ({ page }) => {
  await page.goto('/#/FIN-PROC-01?requestId=PR-2026-0031')

  await page.getByRole('button', { name: '결제·증빙 단계로 이동' }).click()

  await expect(page).toHaveURL(/#\/FIN-EVID-01\?requestId=PR-2026-0031/)
  await expect(page.getByRole('heading', { name: '결제·증빙 정리' })).toBeVisible()
})
