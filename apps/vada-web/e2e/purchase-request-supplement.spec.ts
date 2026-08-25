import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SCREEN = '/#/FIN-SUP-01?requestId=PR-2026-0031'

test('FIN-SUP-01: 재정부가 무엇을 왜 되돌려보냈는지 보여준다', async ({ page }) => {
  await page.goto(SCREEN)

  await expect(page.getByText('요청 담당자 김바다')).toBeVisible()
  await expect(page.getByText('재제출 권장 기한 2026-03-07')).toBeVisible()
  await expect(page.getByText('보완 품목 — 이름표 용지')).toBeVisible()
  await expect(page.getByText(/규격과 인쇄 사양이 누락되었습니다/)).toBeVisible()
})

test('FIN-SUP-01: 무엇을 다시 받을지는 명세가 아니라 데이터가 정한다', async ({ page }) => {
  await page.goto(SCREEN)

  // 이 넷은 '제작·인쇄' 품목이라 나온 것이다. 온라인 구매였다면 판매처와 상품
  // URL이 나왔을 것이고, 명세는 어느 쪽도 알지 못한다.
  const corrections = page.locator('[data-node-id="30:1239"]')
  for (const label of ['사이즈·규격', '색상', '인쇄 위치', '옵션별 수량']) {
    await expect(corrections.getByText(label, { exact: true })).toBeVisible()
  }
})

test('FIN-SUP-01: 다 채우지 않으면 재제출을 막고, 임시 저장은 막지 않는다', async ({ page }) => {
  await page.goto(SCREEN)

  await page.getByRole('button', { name: '수정 내용 재제출' }).click()
  await expect(page.getByRole('alert')).toContainText('아직 채우지 않은 칸이 있습니다')

  // 임시 저장은 executeWhen이 없다 — 아직 넘기지 않았다는 것이 그 뜻이다.
  await page.getByRole('button', { name: '임시 저장' }).click()
  await expect(page).toHaveURL(/#\/FIN-REQ-02\?requestId=PR-2026-0031/)
})

test('FIN-SUP-01: 네 칸을 채우면 재제출하고 요청 상세로 돌아간다', async ({ page }) => {
  await page.goto(SCREEN)

  const corrections = page.locator('[data-node-id="30:1239"]')
  const inputs = corrections.getByRole('textbox')
  const count = await inputs.count()
  for (let index = 0; index < count; index += 1) {
    await inputs.nth(index).fill('채움')
  }

  await page.getByRole('button', { name: '수정 내용 재제출' }).click()
  await expect(page).toHaveURL(/#\/FIN-REQ-02\?requestId=PR-2026-0031/)
})

test('FIN-REQ-02: 보완 내용 확인이 재제출 화면으로 이어진다', async ({ page }) => {
  await page.goto('/#/FIN-REQ-02?requestId=PR-2026-0031')

  await page.getByRole('button', { name: '보완 내용 확인' }).click()

  await expect(page).toHaveURL(/#\/FIN-SUP-01\?requestId=PR-2026-0031/)
  await expect(page.getByRole('heading', { name: '보완 요청 확인·재제출' })).toBeVisible()
})

test('FIN-SUP-01: 인자가 없으면 아무 요청의 보완이나 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/FIN-SUP-01')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('FIN-SUP-01', 'requestId'))
  await expect(page.getByText('보완 품목 — 이름표 용지')).toBeHidden()
})
