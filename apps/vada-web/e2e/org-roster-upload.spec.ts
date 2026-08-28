import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'
const MODAL = '/#/ORG-07B'

// 학생 명단 업로드·갱신(ORG-07B). **첫 모달이다.**
//
// 모달은 화면이면서 화면이 아니다 — 주소로 열 수 있는 한 자리이지만, 뒤에는 열기
// 전에 보던 것이 그대로 남아 있다. 명세가 그것을 말한다(screen.overlay).

test('ORG-07B: 모달 뒤에 원래 화면이 그대로 있다', async ({ page }) => {
  await page.goto(MODAL)

  await expect(page.getByRole('dialog', { name: '학생 명단 업로드·갱신' })).toBeVisible()
  // 뒤의 화면이 사라지지 않는다 — 명세가 overlay.screenId로 말한 그 화면이다.
  // 역할로 찾지 않는다: 모달이 뜨면 뒤는 보조기기에서 감춰지는 것이 맞다.
  await expect(page.locator('[data-node-id="30:5531"] table')).toHaveCount(1)
  await expect(page.getByText('총 8명')).toHaveCount(1)

  await page.screenshot({ path: `${SHOTS}/87-org07b.png`, fullPage: true })
})

// 단계 둘은 이 화면을 여는 동안에만 있는 것이라 서버가 모른다.
// 출처가 없으면 첫 단계에서 시작한다.
test('ORG-07B: 두 단계 중 첫 단계에서 시작한다', async ({ page }) => {
  await page.goto(MODAL)

  await expect(page.getByText('파일 업로드')).toHaveAttribute('aria-current', 'step')
  await expect(page.getByText('검증 결과')).not.toHaveAttribute('aria-current', 'step')
})

test('ORG-07B: 파일을 고르면 그 이름이 보인다', async ({ page }) => {
  await page.goto(MODAL)

  await page.setInputFiles('#rosterFile', {
    name: '명단.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('이름,학번\n김바다,2022123456\n'),
  })

  await expect(page.getByText('명단.csv')).toBeVisible()
})

// 닫으면 뒤에 있던 화면으로 돌아간다 — 명세의 overlay.screenId가 그것이다.
test('ORG-07B: 취소하면 명단으로 돌아간다', async ({ page }) => {
  await page.goto(MODAL)

  await page.getByRole('button', { name: '취소' }).click()

  await expect(page).toHaveURL(/#\/ORG-07A/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('ORG-07B: 검증 결과 단계는 아직 그려지지 않았음을 남긴다', async ({ page }) => {
  await page.goto(MODAL)

  await page.getByRole('button', { name: '검증하기' }).click()

  await expect(page.getByText(/검증 결과 단계가 아직 그려지지 않았습니다/)).toBeVisible()
})

test('ORG-07A: 업로드 버튼이 이 모달을 연다', async ({ page }) => {
  await page.goto('/#/ORG-07A')

  await page.getByRole('button', { name: '학생 명단 업로드·갱신' }).click()

  await expect(page).toHaveURL(/#\/ORG-07B/)
  await expect(page.getByRole('dialog', { name: '학생 명단 업로드·갱신' })).toBeVisible()
})
