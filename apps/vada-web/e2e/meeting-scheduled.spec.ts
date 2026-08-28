import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const DETAIL = '/#/OPS-MEET-03A?meetingId=MTG-05'
// 같은 회의를 다른 사람이 본 그림 둘. **다른 주소가 아니다** — 실제로는 데이터가
// 가른다(meeting.detail의 canEdit·canCancel·canManageHostRole·canStart).
const DETAIL_OWNER = '/#/OPS-MEET-03B?meetingId=MTG-05'
const DETAIL_HOST = '/#/OPS-MEET-03C?meetingId=MTG-05'

// 예정 회의 상세(OPS-MEET-03A).
//
// 이 그림은 보는 사람에 따라 셋으로 갈린다(03A 일반 참가자 · 03B 생성자 ·
// 03C 진행 권한자). 주소는 하나이므로 여기서 확인하는 것은 **셋이 함께 갖는
// 자리**와, 일반 참가자에게는 조작이 하나도 없다는 사실이다.

test('OPS-MEET-03A: 회의 한 건과 보는 사람의 자리를 함께 보여준다', async ({ page }) => {
  await page.goto(DETAIL)

  const breadcrumb = page.getByRole('navigation', { name: '현재 위치' })
  await expect(breadcrumb.getByText('회의', { exact: true })).toBeVisible()
  await expect(breadcrumb.getByText('체육대회 안전 관리 최종 회의')).toBeVisible()

  // 누가 보느냐는 서버만 안다 — 제목도 설명도 데이터에서 온다.
  const notice = page.locator('[data-node-id="18:2879"]')
  await expect(notice.getByText('일반 참가자 화면')).toBeVisible()

  // 딱지가 둘이고 개수가 데이터에 달렸다.
  const meeting = page.locator('[data-node-id="18:2889"]')
  await expect(meeting.getByText('예정', { exact: true })).toBeVisible()
  await expect(meeting.getByText('행사 관련 회의', { exact: true })).toBeVisible()
  await expect(meeting.getByText('박해랑 · 운영부', { exact: true })).toBeVisible()
  await expect(meeting.getByText('2026 소프트웨어융합대학 체육대회')).toBeVisible()

  const facts = page.locator('[data-node-id="18:2914"]')
  await expect(facts.getByText('예정 일시', { exact: true })).toBeVisible()
  await expect(facts.getByText('2026.07.25 15:00', { exact: true })).toBeVisible()
  await expect(facts.getByText('학생회실 (A204)', { exact: true })).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/ops-meet-03a.png`, fullPage: true })
})

// 안건 수와 자료 수는 목록이 아니라 회의가 안다. 몇 번째인지는 반대로 명세에
// 없다 — 이 목록에서의 자리가 곧 순서다.
test('OPS-MEET-03A: 안건과 그 안건의 사전 자료를 함께 보여준다', async ({ page }) => {
  await page.goto(DETAIL)

  const header = page.locator('[data-node-id="18:2967"]')
  await expect(header.getByText('안건과 사전 자료')).toBeVisible()
  await expect(header.getByText('총 3개 · 예상 60분')).toBeVisible()
  await expect(header.getByText('등록 자료 3개')).toBeVisible()

  const agendas = page.locator('[data-node-id="18:2975"]')
  await expect(agendas.getByRole('listitem')).toHaveCount(3)

  const first = agendas.getByRole('listitem').first()
  await expect(first.getByText('1', { exact: true })).toBeVisible()
  await expect(first.getByText('행사장 안전 점검 결과')).toBeVisible()

  // 자료는 회의에 한 번 붙어 오고 어느 안건의 것인지는 그 조각이 안다.
  await expect(
    page.locator('[data-node-id="18:2987"]').getByText('체육대회_안전점검표.pdf'),
  ).toBeVisible()
})

// 역할 이름은 명세에 없다. 딱지의 글도 색도, 무엇을 할 수 있는지도 서버가 준다.
test('OPS-MEET-03A: 참가자마다 딱지와 할 수 있는 일을 데이터가 준 대로 그린다', async ({
  page,
}) => {
  await page.goto(DETAIL)

  await expect(
    page.locator('[data-node-id="18:3035"]').getByText('초대 4명 · 진행 권한 2명'),
  ).toBeVisible()

  const people = page.locator('[data-node-id="18:3040"]')
  // **수를 세지 않는다.** 같은 회의(MTG-05)를 03A는 넷으로, 04B는 여섯으로 그렸다 —
  // 와이어프레임끼리 어긋난 자리다. 명세도 화면도 수를 세지 않으므로(서버가 완성한
  // 문구를 그린다) 검사도 세면 안 된다. 세면 그림의 어긋남을 검사가 붙들게 된다.
  await expect(people.getByRole('listitem').first()).toBeVisible()

  // 한 사람에 딱지가 여럿일 수 있다 — 생성자는 둘을 함께 단다.
  const creator = people.getByRole('listitem').filter({ hasText: '박해랑' })
  await expect(creator.getByText('회의 생성자', { exact: true })).toBeVisible()
  await expect(creator.getByText('진행 권한', { exact: true })).toBeVisible()
  await expect(creator.getByText('시작·종료 가능', { exact: true })).toBeVisible()

  const member = people.getByRole('listitem').filter({ hasText: '이수현' })
  await expect(member.getByText('일반 참가자', { exact: true })).toBeVisible()
})

// 일반 참가자에게는 조작이 하나도 없다. '회의 시작'·'회의 수정'·'진행 권한 관리'는
// 03B·03C의 것이고, 그 사실이 이 셋을 변형으로 가른 이유다.
test('OPS-MEET-03A: 아직 시작되지 않았다는 것만 알리고 조작은 두지 않는다', async ({
  page,
}) => {
  await page.goto(DETAIL)

  await expect(
    page.locator('[data-node-id="18:2955"]').getByText('아직 회의가 시작되지 않았습니다'),
  ).toBeVisible()

  await expect(page.getByRole('button', { name: '회의 시작' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '회의 수정' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '진행 권한 관리' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '회의 취소' })).toHaveCount(0)
})

test('OPS-MEET-03A: 회의 id가 없으면 아무 회의나 대신 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/OPS-MEET-03A')

  await expect(page.getByRole('alert')).toContainText(
    missingNoteOf('OPS-MEET-03A', 'meetingId'),
  )
  await expect(page.locator('[data-node-id="18:2889"]')).toHaveCount(0)
})

test('OPS-MEET-03A: 없는 회의를 물으면 못 찾았다고 말한다', async ({ page }) => {
  await page.goto('/#/OPS-MEET-03A?meetingId=MTG-404')

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('[data-node-id="18:2889"]')).toHaveCount(0)
})

test('OPS-MEET-03A: 일반 참가자에게는 회의를 다루는 단추가 하나도 없다', async ({ page }) => {
  await page.goto(DETAIL)

  for (const name of ['회의 수정', '회의 시작', '회의 취소', '진행 권한 관리']) {
    await expect(page.getByRole('button', { name })).toHaveCount(0)
  }
})

test('OPS-MEET-03B: 회의를 만든 사람은 고치고 시작하고 취소하고 권한을 옮긴다', async ({
  page,
}) => {
  await page.goto(DETAIL_OWNER)

  await expect(page.getByRole('button', { name: '회의 수정' })).toBeVisible()
  await expect(page.getByRole('button', { name: '회의 취소' })).toBeVisible()
  await expect(page.getByRole('button', { name: '진행 권한 관리' })).toBeVisible()

  await page.getByRole('button', { name: '회의 시작' }).click()
  await expect(page).toHaveURL(/#\/OPS-MEET-D01\?meetingId=MTG-05/)
})

test('OPS-MEET-03C: 진행만 하는 사람은 시작만 하고 사람 카드는 읽기만 한다', async ({
  page,
}) => {
  await page.goto(DETAIL_HOST)

  await expect(page.getByRole('button', { name: '회의 시작' })).toBeVisible()
  // 고치는 것은 만든 사람의 몫이다.
  for (const name of ['회의 수정', '회의 취소', '진행 권한 관리']) {
    await expect(page.getByRole('button', { name })).toHaveCount(0)
  }
  await expect(page.locator('[data-node-id="20:581"]')).toHaveText('읽기 전용')
})
