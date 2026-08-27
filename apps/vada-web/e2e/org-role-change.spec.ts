import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'
const MANAGE = '/#/ORG-04B'

// 역할 및 권한 관리 — 회장단(ORG-04B). ORG-04가 읽는 것을 여기서 바꾼다.
//
// **바뀌는 것은 사람의 역할이지 역할의 집합이 아니다.** 이 화면이 그것을 적어
// 두었기 때문에 ORG-04의 권한 표가 열 셋을 명세에 고정으로 갖는다.

test('ORG-04B: 구성원마다 지금의 기본 역할을 보여준다', async ({ page }) => {
  await page.goto(MANAGE)

  await expect(page.getByText('구성원 기본 역할')).toBeVisible()
  await expect(page.getByText('7명')).toBeVisible()
  await expect(page.getByRole('button').filter({ hasText: '김바다' })).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/85-org04b.png`, fullPage: true })
})

// 고를 수 있는 것은 고정된 셋이다. 명세는 '펼친 묶음에서 고른다'까지 말하고,
// 칩이냐 설명이 붙은 줄이냐는 design이 정한다.
test('ORG-04B: 고를 수 있는 역할은 셋뿐이다', async ({ page }) => {
  await page.goto(MANAGE)

  const choices = page.getByRole('radio')
  await expect(choices).toHaveCount(3)
  for (const name of ['회장단', '부서장', '부원']) {
    await expect(choices.filter({ hasText: name })).toHaveCount(1)
  }

  // 처음 골라져 있는 것은 그 사람의 지금 역할이다.
  await expect(choices.filter({ hasText: '부원' })).toHaveAttribute('aria-checked', 'true')
})

test('ORG-04B: 다른 역할을 고르면 그것이 골라진다', async ({ page }) => {
  await page.goto(MANAGE)

  await page.getByRole('radio').filter({ hasText: '부서장' }).click()

  await expect(page.getByRole('radio').filter({ hasText: '부서장' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByRole('radio').filter({ hasText: '부원' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
})

test('ORG-04B: 권한을 바꾸면 역할 및 권한으로 돌아간다', async ({ page }) => {
  await page.goto(MANAGE)

  await page.getByRole('button', { name: '권한 변경' }).click()

  await expect(page).toHaveURL(/#\/ORG-04/)
  await expect(page.getByRole('table', { name: '기능 영역별 권한' })).toBeVisible()
})

// 어느 구성원을 고를지가 아직 주소로 오가지 않는다. 지어내지 않고 남긴다.
test('ORG-04B: 구성원을 누르면 아직 정해지지 않았음을 남긴다', async ({ page }) => {
  await page.goto(MANAGE)

  await page.getByRole('button').filter({ hasText: '이수현' }).click()

  await expect(page.getByText(/아직 주소로 오가지 않습니다/)).toBeVisible()
})
