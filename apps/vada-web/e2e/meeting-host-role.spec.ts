import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const MANAGE = '/#/OPS-MEET-04B?meetingId=MTG-05'

// 회의 진행 권한 관리(OPS-MEET-04B).
//
// **모달이 아니라 화면이다** — D03(부여 확인)이 이 화면 위에 뜬다. 그래서 주소가
// 있고, 어느 회의의 권한인지를 주소가 실어 온다.
//
// 여기서 확인하는 것은 하나다: **역할 이름도 줄 단추의 글도 화면이 갖고 있지
// 않다.** '진행 권한'도 '권한 해제'도 '진행 권한 부여'도 데이터가 준 글이고,
// 권한이 무엇을 주고 무엇을 안 주는지도 서버가 완성한 문장이다.

test('OPS-MEET-04B: 이 회의에만 적용되는 권한이라는 것을 서버가 말한 대로 알린다', async ({
  page,
}) => {
  await page.goto(MANAGE)

  const breadcrumb = page.getByRole('navigation', { name: '현재 위치' })
  await expect(breadcrumb.getByText('체육대회 안전 관리 최종 회의')).toBeVisible()
  await expect(breadcrumb.getByText('진행 권한 관리', { exact: true })).toBeVisible()

  // 안내의 제목도 본문도 명세에 없다 — 권한이 하나 늘면 이 글이 바뀐다.
  const notice = page.locator('[data-node-id="20:754"]')
  await expect(notice.getByText('이 회의에만 적용되는 권한입니다')).toBeVisible()
  await expect(notice).toContainText('진행 권한자는')
  await expect(notice).toContainText('회의 생성자만')

  await page.screenshot({ path: `${SHOTS}/ops-meet-04b.png`, fullPage: true })
})

// 몇 명인지도 지켜야 하는 규칙도 서버가 완성해 온다. 화면이 목록을 세면 검색으로
// 줄어든 수를 전체인 양 말하게 되고, 그림이 스스로 어긋난 자리(부제는 5명인데
// 목록이 다섯에 생성자가 하나 더)를 그대로 옮기게 된다.
test('OPS-MEET-04B: 인원 수와 지켜야 하는 규칙을 화면이 세지 않는다', async ({ page }) => {
  await page.goto(MANAGE)

  const header = page.locator('[data-node-id="20:788"]')
  await expect(header.getByText('참가자별 진행 권한')).toBeVisible()
  await expect(header.getByText(/진행 권한자 \d+명/)).toBeVisible()
  await expect(header.getByText('최소 1명 유지')).toBeVisible()
})

// 같은 자리가 줄에 따라 주는 쪽이 되기도 빼는 쪽이 되기도 한다. 명세가 '진행 권한
// 부여'라고 적어 두면 역할이 하나 늘 때 그 글이 거짓이 된다.
test('OPS-MEET-04B: 줄 오른쪽 단추의 글과 강조를 데이터가 정한다', async ({ page }) => {
  await page.goto(MANAGE)

  const rows = page.locator('[data-node-id="20:804"]').getByRole('listitem')

  const host = rows.filter({ hasText: '정하늘' })
  await expect(host.getByText('진행 권한', { exact: true })).toBeVisible()
  await expect(host.getByRole('button')).toHaveCount(1)
  await expect(host.getByRole('button', { name: '권한 해제' })).toBeVisible()

  const member = rows.filter({ hasText: '이수현' })
  await expect(member.getByRole('button', { name: '진행 권한 부여' })).toBeVisible()
})

// 조용히 대신하지 않는다. 주는 쪽은 확인 모달(D03)을 거치는데 그 화면이 아직
// 명세되지 않았고, 빼는 쪽은 확인 모달이 아예 그려져 있지 않다.
test('OPS-MEET-04B: 권한을 누르면 아직 정해지지 않았음을 남긴다', async ({ page }) => {
  await page.goto(MANAGE)

  await page
    .locator('[data-node-id="20:804"]')
    .getByRole('listitem')
    .filter({ hasText: '이수현' })
    .getByRole('button')
    .click()

  await expect(page.getByRole('status')).toContainText(/OPS-MEET-D03/)
})

// 받아온 것을 화면에서 거르지 않는다 — 검색어가 바뀌면 다시 조회한다.
test('OPS-MEET-04B: 이름이나 부서로 참가자를 좁혀 본다', async ({ page }) => {
  await page.goto(MANAGE)

  const rows = page.locator('[data-node-id="20:804"]').getByRole('listitem')
  await expect(rows.filter({ hasText: '이수현' })).toHaveCount(1)

  await page.getByRole('searchbox', { name: '이름 또는 부서 검색' }).fill('재정')

  await expect(rows.filter({ hasText: '김민준' })).toHaveCount(1)
  await expect(rows.filter({ hasText: '이수현' })).toHaveCount(0)
})

// 권한은 줄마다 그 자리에서 바뀌므로 여기서 보낼 것이 없다 — 되돌아갈 뿐이고,
// 어느 회의로 돌아갈지는 받은 인자가 안다.
test('OPS-MEET-04B: 관리 완료를 누르면 그 회의의 상세로 돌아간다', async ({ page }) => {
  await page.goto(MANAGE)

  await page.getByRole('button', { name: '관리 완료' }).click()

  await expect(page).toHaveURL(/#\/OPS-MEET-03A\?meetingId=MTG-05$/)
  await expect(page.getByText('예정 일시', { exact: true })).toBeVisible()
})

// 진행 권한은 그 회의에만 적용된다. 어느 회의인지 모르는 채로 아무 회의나
// 집어 오면 남의 회의 권한을 바꾸게 된다.
test('OPS-MEET-04B: 회의 id가 없으면 아무 회의나 대신 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/OPS-MEET-04B')

  await expect(page.getByRole('alert')).toContainText(
    missingNoteOf('OPS-MEET-04B', 'meetingId'),
  )
  await expect(page.locator('[data-node-id="20:804"]')).toHaveCount(0)
})
