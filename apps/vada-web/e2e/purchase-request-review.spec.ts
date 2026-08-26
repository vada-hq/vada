import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SCREEN = '/#/FIN-REV-01?requestId=PR-2026-0031'

test('FIN-REV-01: 재정부만 보는 값이 함께 온다', async ({ page }) => {
  await page.goto(SCREEN)

  // 요청자가 보는 화면(FIN-REQ-02)에는 없는 값이다. 같은 요청이라도 출처가 다르다.
  await expect(page.getByText('예산 사용 가능액')).toBeVisible()
  await expect(page.getByText('950,000원')).toBeVisible()
})

test('FIN-REV-01: 앞서 내린 판정이 그대로 들어 있다', async ({ page }) => {
  await page.goto(SCREEN)

  // 검토는 한 번에 끝나지 않는다. 항목의 칸은 조각 이름이 같으면 그 값으로 시작한다.
  await expect(page.getByRole('radio', { name: '보완' }).nth(2)).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByRole('radio', { name: '승인' }).first()).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

test('FIN-REV-01: 보완이 하나라도 있으면 보내는 것이 보완 요청이다', async ({ page }) => {
  await page.goto(SCREEN)

  await expect(page.getByRole('button', { name: '보완 요청 발송' })).toBeVisible()

  // 그 하나를 승인으로 바꾸면 나가는 것이 검토 결과가 된다. 버튼은 여전히 하나다.
  await page.getByRole('radio', { name: '승인' }).nth(2).click()
  await expect(page.getByRole('button', { name: '검토 완료' })).toBeVisible()
  await expect(page.getByRole('button', { name: '보완 요청 발송' })).toBeHidden()
})

test('FIN-REV-01: 판정하지 않은 품목이 있으면 보내지 못한다', async ({ page }) => {
  await page.goto(SCREEN)

  // 승인액을 지우면 그 줄이 아직 판정되지 않은 것이 된다.
  await page.getByRole('spinbutton', { name: '박스테이프 승인액' }).fill('')
  await page.getByRole('button', { name: /보완 요청 발송|검토 완료/ }).click()

  await expect(page.getByRole('alert')).toContainText('아직 판정하지 않은 품목이 있습니다')
})

test('FIN-REV-01: 다 판정하면 보내고 요청 상세로 돌아간다', async ({ page }) => {
  await page.goto(SCREEN)

  await page.getByRole('button', { name: /보완 요청 발송|검토 완료/ }).click()

  await expect(page).toHaveURL(/#\/FIN-REQ-02\?requestId=PR-2026-0031/)
})

test('FIN-REV-01: 인자가 없으면 아무 요청이나 검토하게 두지 않는다', async ({ page }) => {
  await page.goto('/#/FIN-REV-01')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('FIN-REV-01', 'requestId'))
  await expect(page.getByRole('table')).toBeHidden()
})
