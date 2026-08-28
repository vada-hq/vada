import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'
const LIST = '/#/OPS-MEET-01A'
// 새 회의를 만들 수 있는 사람이 본 같은 화면(변형 OPS-MEET-01C).
const LIST_CREATOR = '/#/OPS-MEET-01C'

// 회의 목록(OPS-MEET-01A)은 주소가 하나인데 와이어프레임에 넷이 있다 —
// 일반 참가자 · 진행 권한자 · 회의 생성 가능 · 미참가자.
//
// **사람이 그 사이를 오갈 수 없다.** 누가 보느냐가 정하는 것이지 어디로 가느냐가
// 정하는 것이 아니다. 그래서 화면이 아니라 변형이고(screen.variantOf), 띠와 줄의
// 딱지는 서버가 준다.

test('OPS-MEET-01A: 띠가 보는 사람이 누구인지 말한다', async ({ page }) => {
  await page.goto(LIST)

  // 명세는 이 글을 갖지 않는다 — 역할이 하나 늘 때마다 명세가 틀리기 때문이다.
  await expect(page.getByText('일반 참가자 화면')).toBeVisible()
  await expect(page.getByText('초대된 회의의 일정과 참가 상태를 확인합니다.')).toBeVisible()
  await expect(page.getByText('확인 필요한 회의 2건')).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/89-meeting-list.png`, fullPage: true })
})

// 줄마다의 단추도 그 회의와 보는 사람의 관계가 정한다.
test('OPS-MEET-01A: 회의마다 할 수 있는 일이 다르다', async ({ page }) => {
  await page.goto(LIST)

  await expect(page.getByRole('button', { name: '회의록 보기' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: '회의로 돌아가기' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: '회의 상세 보기' }).first()).toBeVisible()
})

// 지금 보는 사람은 일반 참가자다 — 새 회의를 만들 수 없고 딱지도 붙지 않는다.
test('OPS-MEET-01A: 만들 수 없는 사람에게는 그 단추가 없다', async ({ page }) => {
  await page.goto(LIST)

  await expect(page.getByRole('button', { name: '새 회의 만들기' })).toHaveCount(0)
  await expect(page.getByText('진행 권한', { exact: true })).toHaveCount(0)
})

// 넷 중 하나는 머리에 단추가 온다. **다른 화면이 아니다** — 명세가 조건을 든다
// (meeting.attention의 canCreateMeeting). 없는 쪽은 바로 위에서 이미 본다.
test('OPS-MEET-01C: 만들 수 있는 사람은 그 자리에서 회의를 만들러 간다', async ({ page }) => {
  await page.goto(LIST_CREATOR)

  await page.getByRole('button', { name: '새 회의 만들기' }).click()

  await expect(page).toHaveURL(/#\/OPS-MEET-02/)
})
