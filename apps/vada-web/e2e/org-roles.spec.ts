import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'
const ROLES = '/#/ORG-04'

// 역할 및 권한(ORG-04). 읽기만 하는 화면이다.
//
// **역할 셋은 명세가 갖는다.** 짝 화면(ORG-04B)이 "회장단·부서장·부원으로 변경할
// 수 있습니다"라고 적어 두었다 — 바뀌는 것은 사람의 역할이지 역할의 집합이 아니다.

test('ORG-04: 역할 셋과 기능 영역별 권한을 보여준다', async ({ page }) => {
  await page.goto(ROLES)

  for (const role of ['회장단', '부서장', '부원']) {
    await expect(page.getByText(role, { exact: true }).first()).toBeVisible()
  }

  await expect(page.getByRole('table', { name: '기능 영역별 권한' })).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(14)

  await page.screenshot({ path: `${SHOTS}/84-org04.png`, fullPage: true })
})

// 칸에 오는 것은 '되는가'가 아니라 **어떤 조건에서 되는가**다. 그 말의 목록은
// 서버가 갖는다 — 조건이 하나 늘 때 화면이 짐작하지 않게 하기 위해서다.
test('ORG-04: 권한 칸은 조건까지 말한다', async ({ page }) => {
  await page.goto(ROLES)

  const row = page.getByRole('row').filter({ hasText: '예산 수정·구매 승인·증빙 처리' })
  await expect(row.getByText('가능', { exact: true })).toHaveCount(1)
  await expect(row.getByText('재정부만', { exact: true })).toHaveCount(2)
})

test('ORG-04: 회의·행사에서만 생기는 역할을 따로 적는다', async ({ page }) => {
  await page.goto(ROLES)

  await expect(page.getByText('회의·행사에서 별도로 부여되는 역할')).toBeVisible()
  await expect(page.getByText(/회의 진행 권한자/)).toBeVisible()
  // 넷째 문단은 셋째의 부연이다 — 역할 정의가 아니라 그 역할의 한계를 말한다.
  await expect(page.getByText(/행사 완료 처리는 회장단만 가능합니다/)).toBeVisible()
})

test('ORG-00: 역할 및 권한 카드가 이 화면으로 이어진다', async ({ page }) => {
  await page.goto('/#/ORG-00')

  await page.getByRole('button', { name: /역할 및 권한/ }).click()

  await expect(page).toHaveURL(/#\/ORG-04/)
  await expect(page.getByRole('table', { name: '기능 영역별 권한' })).toBeVisible()
})
