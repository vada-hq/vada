import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'
const INVITE = '/#/ORG-03C'

// 구성원 초대 패널(ORG-03C). 조직도 곁에 붙는 칸이다.
//
// 여기서 처음인 것은 **가져가기**다 — 초대 링크와 코드는 사람이 붙여 넣어 남에게
// 보내라고 그려 둔 값이고, 그것을 집어 가는 것은 보내는 것도 어디로 가는 것도 아니다.

test('ORG-03C: 초대 링크와 코드를 보여준다', async ({ page }) => {
  await page.goto(INVITE)

  await expect(page.getByText('초대 정보', { exact: true })).toBeVisible()
  await expect(page.getByText('활성', { exact: true })).toBeVisible()
  await expect(page.getByText('https://vada.app/join/swcollege12/abc123xyz')).toBeVisible()
  await expect(page.getByText('AB12CD34')).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/83-org03c.png`, fullPage: true })
})

// 뒤에 비치는 조직도는 부서를 **이름만** 그린다. 초대하는 동안 누가 어느 부서인지는
// 볼 일이 아니다 — 같은 데이터인데 이 화면만 덜 그린다.
test('ORG-03C: 뒤의 조직도는 부서 이름만 보여준다', async ({ page }) => {
  await page.goto(INVITE)

  await expect(page.getByText('기획부', { exact: true })).toBeVisible()
  // 회장단은 그대로 사람까지 보인다.
  await expect(page.getByText('김바다', { exact: true })).toBeVisible()
  // 부서의 사람은 이 화면에 없다.
  await expect(page.getByText('부서장', { exact: true })).toHaveCount(0)
  await expect(page.getByText('부원 2명')).toHaveCount(0)
})

test('ORG-03C: 링크를 가져갈 수 있다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(INVITE)

  await page.getByRole('button', { name: '링크 복사' }).click()

  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toBe('https://vada.app/join/swcollege12/abc123xyz')
})

test('ORG-03C: 코드를 가져갈 수 있다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(INVITE)

  await page.getByRole('button', { name: '코드 복사' }).click()

  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toBe('AB12CD34')
})

// 돌아가는 자리는 조직도를 고치던 화면이다. 여기로 오는 입구가 둘 다 그곳에 있고,
// 그 화면은 고치던 초안을 들고 있다.
test('ORG-03C: 조직 관리로 돌아가면 고치던 화면이다', async ({ page }) => {
  await page.goto(INVITE)

  await page.getByRole('button', { name: '조직 관리로' }).click()

  await expect(page).toHaveURL(/#\/ORG-03B/)
})

test('ORG-03B: 구성원 초대가 이 패널로 이어진다', async ({ page }) => {
  await page.goto('/#/ORG-03B')

  await page.getByRole('button', { name: '구성원 초대' }).click()

  await expect(page).toHaveURL(/#\/ORG-03C/)
  await expect(page.getByText('짧은 초대 코드')).toBeVisible()
})
