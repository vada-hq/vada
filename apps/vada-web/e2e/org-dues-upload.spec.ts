import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'
const MODAL = '/#/ORG-07C'

// 학생회비 납부 명단 업로드(ORG-07C). 조직 갈래의 마지막이고 **두 번째 모달**이다.
//
// ORG-07B에서 만든 어휘(screen.overlay)가 여기서 그대로 선다 — 한 번 쓴 어휘가
// 다음 화면에서 손대지 않고 서는 것이 이 사이클의 값이다.

test('ORG-07C: 모달 뒤에 명단 화면이 그대로 있다', async ({ page }) => {
  await page.goto(MODAL)

  await expect(page.getByRole('dialog', { name: '학생회비 납부 명단 업로드' })).toBeVisible()
  await expect(page.locator('[data-node-id="30:5531"] table')).toHaveCount(1)

  await page.screenshot({ path: `${SHOTS}/88-org07c.png`, fullPage: true })
})

// 다른 점은 하나다: 어느 학기의 납부인지를 **파일보다 먼저** 고른다.
// 학기 목록은 조직이 언제부터 있었는지에 달려 명세가 들 수 없다.
test('ORG-07C: 기준 학기를 먼저 고른다', async ({ page }) => {
  await page.goto(MODAL)

  const term = page.getByRole('combobox', { name: '기준 학기' })
  await expect(term).toBeVisible()
  await term.click()
  await page.getByRole('option').first().click()

  await expect(term).toContainText('학기')
})

test('ORG-07C: 파일을 고르면 그 이름이 보인다', async ({ page }) => {
  await page.goto(MODAL)

  await page.setInputFiles('#duesFile', {
    name: '납부자.xlsx',
    mimeType: 'application/vnd.ms-excel',
    buffer: Buffer.from('학번\n2022123456\n'),
  })

  await expect(page.getByText('납부자.xlsx')).toBeVisible()
})

test('ORG-07C: 취소하면 명단으로 돌아간다', async ({ page }) => {
  await page.goto(MODAL)

  await page.getByRole('button', { name: '취소' }).click()

  await expect(page).toHaveURL(/#\/ORG-07A/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('ORG-07A: 납부 명단 버튼이 이 모달을 연다', async ({ page }) => {
  await page.goto('/#/ORG-07A')

  await page.getByRole('button', { name: '학생회비 납부 명단 업로드' }).click()

  await expect(page).toHaveURL(/#\/ORG-07C/)
  await expect(page.getByRole('dialog', { name: '학생회비 납부 명단 업로드' })).toBeVisible()
})
