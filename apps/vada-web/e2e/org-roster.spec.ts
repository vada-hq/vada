import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'
const ROSTER = '/#/ORG-07A'

// 학생 명단 관리(ORG-07A).
//
// 여기서 처음인 것은 **줄 전체의 색**이다 — 지금까지 색은 칸 하나의 딱지였는데
// 이 명단은 손봐야 하는 학생의 줄을 통째로 다르게 그린다.

test('ORG-07A: 명단과 관리 범위를 보여준다', async ({ page }) => {
  await page.goto(ROSTER)

  await expect(page.getByText('관리 범위')).toBeVisible()
  await expect(
    page.getByText('한양대학교 ERICA › 소프트웨어융합대학 › 컴퓨터학부'),
  ).toBeVisible()
  await expect(page.getByRole('table', { name: '학생 명단' })).toBeVisible()
  await expect(page.getByText('총 8명')).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/86-org07a.png`, fullPage: true })
})

// 명세가 말하는 것은 '이 줄은 다른 줄과 다르다'와 그것을 아는 조각뿐이다.
// 대부분의 줄에는 색 이름이 없어 아무 표시도 하지 않는다.
test('ORG-07A: 손봐야 하는 줄만 다르게 그린다', async ({ page }) => {
  await page.goto(ROSTER)

  await expect(page.getByRole('row').filter({ hasText: '최바람' })).toHaveClass(/bg-yellow-50/)
  await expect(page.getByRole('row').filter({ hasText: '김바다' })).not.toHaveClass(
    /bg-yellow-50/,
  )
})

// 거르는 값은 조회 인자다 — 받아온 것을 화면에서 거르지 않는다.
test('ORG-07A: 이름으로 찾으면 그 학생만 남는다', async ({ page }) => {
  await page.goto(ROSTER)

  await page.getByRole('searchbox', { name: '이름, 학번 검색' }).fill('최바람')

  await expect(page.getByRole('row')).toHaveCount(2)
  await expect(page.getByText('총 1명')).toBeVisible()
})

test('ORG-07A: 학생회비 상태로 거른다', async ({ page }) => {
  await page.goto(ROSTER)

  await page.getByRole('combobox', { name: '학생회비 납부 상태' }).click()
  await page.getByRole('option', { name: '미납', exact: true }).click()

  await expect(page.getByText('총 3명')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: '김바다' })).toHaveCount(0)
})

// 업로드 버튼은 ORG-07B가 생기면서 실제로 이어졌다(org-roster-upload.spec.ts).
// 아직 정해지지 않은 것은 내보내기 하나다.
test('ORG-07A: 아직 없는 자리는 그 사실을 남긴다', async ({ page }) => {
  await page.goto(ROSTER)

  await page.getByRole('button', { name: '명단 내보내기' }).click()

  await expect(page.getByText(/명단을 내보내는 방법이 아직/)).toBeVisible()
})

test('ORG-00: 학생 명단 카드가 이 화면으로 이어진다', async ({ page }) => {
  await page.goto('/#/ORG-00')

  await page.getByRole('button', { name: /학생 명단/ }).click()

  await expect(page).toHaveURL(/#\/ORG-07A/)
  await expect(page.getByRole('table', { name: '학생 명단' })).toBeVisible()
})
