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

  // 처음 골라져 있는 것은 **첫 줄 사람의 지금 역할**이다. 누가 처음 골라져 있는지는
  // 명세가 말하지 않는다 — 서버가 '마지막으로 고른 사람'을 기억하던 자리를 없앴기
  // 때문이다. 목록의 첫 줄로 두는 것은 그리는 쪽의 판단이다.
  await expect(choices.filter({ hasText: '회장단' })).toHaveAttribute('aria-checked', 'true')
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

// **고른 사람이 화면의 값이 된다**(명세의 itemAction.choose).
//
// 이 자리는 오래 'pending'이었고, 서버가 '마지막으로 고른 사람'을 기억해 대신하고
// 있었다 — 사람마다 다른 서버 상태라 두 사람이 같은 화면을 열면 서로의 고른 것을
// 본다. 이제 고른 것이 화면에 남고 곁의 요소들이 그것을 읽는다.
test('ORG-04B: 구성원을 고르면 그 사람이 아래에 그려진다', async ({ page }) => {
  await page.goto(MANAGE)

  await page.getByRole('button').filter({ hasText: '이수현' }).click()

  // 고른 사람이 아래 칸에 온다 — 이수현은 기획부 부서장이다. 목록에도 '기획부'가
  // 있으므로 아래 칸의 것으로 좁힌다(그쪽만 '현재'를 달고 있다).
  await expect(page.getByText('기획부 · 현재')).toBeVisible()

  // 고르면 역할 고르기도 그 사람의 지금 역할로 돌아간다.
  await expect(page.getByRole('radio').filter({ hasText: '부서장' })).toHaveAttribute(
    'aria-checked',
    'true',
  )

  // 화면을 떠나지 않는다 — 목록이 그대로 있다.
  await expect(page.getByRole('button').filter({ hasText: '김바다' })).toBeVisible()
})
