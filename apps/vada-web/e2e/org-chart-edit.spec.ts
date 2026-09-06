import { expect, test } from '@playwright/test'
import { pendingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const EDIT = '/#/ORG-03B'

// 조직 관리 — 수정(ORG-03B). 여기서 처음인 것은 **사람이 자리를 옮기는 것**이다.
// 한 사람은 정확히 한 자리에 있고, 옮기면 저쪽에서 사라지고 이쪽에 생긴다.

test('ORG-03B: 고치기 전에는 저장된 조직도를 그대로 보여준다', async ({ page }) => {
  await page.goto(EDIT)

  await expect(
    page.getByRole('heading', { name: '제12대 소프트웨어융합대학 학생회' }),
  ).toBeVisible()
  await expect(page.getByText('미배정 구성원')).toBeVisible()
  await expect(page.getByText('2명 · 드래그해서 부서로 이동')).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/82-org03b.png`, fullPage: true })
})

// 자리에서 빼는 단추는 글이 없다 — 동그란 표시 하나뿐이라 이름은 보조기기만 읽는다.
// **지우는 것이 아니라 옮기는 것**이고, 가는 곳이 미배정으로 정해져 있다.
test('ORG-03B: 자리에서 빼면 미배정으로 간다', async ({ page }) => {
  await page.goto(EDIT)

  // 사이드바도 complementary라 이름으로 집으면 왼쪽의 사람까지 센다.
  const pool = page.locator('[data-node-id="30:5101"]')
  await expect(pool.getByText('김바다', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: '김바다 회장단에서 빼기' }).click()

  // 회장단에서 사라지고 미배정에 생긴다. 조직에서 없어진 것이 아니다.
  await expect(pool.getByText('김바다', { exact: true })).toHaveCount(1)
})

// 미배정에서만 아주 지울 수 있다. 배정된 사람에게는 이 조작이 없다.
//
// **여기서 지우지 않는다.** 한동안 이 단추가 초안에서 줄을 빼기만 했고, 그 초안을
// '완료'로 저장하면 서버가 받을 수 없어 422가 났다 — 자리를 옮기다 손이 미끄러진
// 것과 사람을 내보내는 것이 같은 저장으로 나가고 있었다. 되돌릴 수 없는 일은 그
// 일만 하는 자리로 간다.
test('ORG-03B: 미배정 구성원의 삭제는 확인 화면으로 간다', async ({ page }) => {
  await page.goto(EDIT)

  // 사이드바도 complementary라 이름으로 집으면 왼쪽의 사람까지 센다.
  const pool = page.locator('[data-node-id="30:5101"]')
  await expect(pool.getByText('정하늘', { exact: true })).toHaveCount(1)

  await pool.getByRole('button', { name: '구성원 삭제' }).first().click()

  // 누구를 내보내는지 주소가 실어 간다 — 서버가 기억하지 않는다.
  await expect(page).toHaveURL(/#\/ORG-03D\?memberId=/)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: '김바다 님을 내보낼까요?' })).toBeVisible()
})

// 확인 화면에서 물러서면 고치던 조직도가 그대로 있다. 같은 스코프를 쓰는 까닭이다.
test('ORG-03D: 돌아가기를 누르면 고치던 자리가 그대로다', async ({ page }) => {
  await page.goto(EDIT)

  const pool = page.locator('[data-node-id="30:5101"]')
  await pool.getByRole('button', { name: '구성원 삭제' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: '돌아가기' }).click()

  await expect(page).toHaveURL(/#\/ORG-03B/)
  await expect(pool.getByText('정하늘', { exact: true })).toHaveCount(1)
})

// 거르는 일은 출처가 한다. 화면은 그 결과와 초안이 말하는 자리를 겹쳐 볼 뿐이다.
test('ORG-03B: 이름으로 미배정 구성원을 좁힌다', async ({ page }) => {
  await page.goto(EDIT)

  // 사이드바도 complementary라 이름으로 집으면 왼쪽의 사람까지 센다.
  const pool = page.locator('[data-node-id="30:5101"]')
  await expect(pool.getByText('정하늘', { exact: true })).toHaveCount(1)
  await expect(pool.getByText('박해랑', { exact: true })).toHaveCount(1)

  await page.getByRole('textbox', { name: '이름 검색' }).fill('정하늘')

  await expect(pool.getByText('정하늘', { exact: true })).toHaveCount(1)
  await expect(pool.getByText('박해랑', { exact: true })).toHaveCount(0)
})

test('ORG-03B: 아직 정해지지 않은 자리는 그 사실을 남긴다', async ({ page }) => {
  await page.goto(EDIT)

  await page.getByRole('button', { name: '부서 추가' }).click()
  await expect(page.getByText(pendingNoteOf('ORG-03B', '부서 추가'))).toBeVisible()
})

// 완료는 실제로 보낸다. 보내고 나면 보기 화면으로 돌아가고 초안은 비워진다.
test('ORG-03B: 완료하면 보기 화면으로 돌아간다', async ({ page }) => {
  await page.goto(EDIT)

  await page.getByRole('button', { name: '완료' }).click()

  await expect(page).toHaveURL(/#\/ORG-03A/)
})
