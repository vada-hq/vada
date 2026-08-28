import { expect, test } from '@playwright/test'
import { missingNoteOf, successNoteAt } from './spec'

const SHOTS = 'e2e/shots'
const DONE = '/#/OPS-MEET-07?meetingId=MTG-01'
// 같은 회의록을 참석하지 않은 사람이 본 그림(변형 OPS-MEET-08). **다른 주소가
// 아니다** — 참석했는지는 회의가 끝난 시점에 정해진 사실이고 데이터가 가른다.
const DONE_ABSENT = '/#/OPS-MEET-08?meetingId=MTG-01'

// 완료된 회의록(OPS-MEET-07).
//
// 이 그림도 보는 사람에 따라 갈린다(07 참석자 · 08 불참자). 주소는 하나이므로
// 여기서 확인하는 것은 **둘이 함께 갖는 자리**와, 참석자에게는 확인을 요구하는
// 조작이 없다는 사실이다.
//
// 회의의 상태와 회의록의 상태는 다른 축이다(docs/decisions/meeting-model.md).
// 띠에 딱지가 둘 달리는 것이 그 사실의 모습이다 — '완료'는 회의록의 상태이고
// '15:07 참석'은 보는 사람의 기록이다.

test('OPS-MEET-07: 회의록이 정리되었다는 사실과 보는 사람의 기록을 함께 단다', async ({
  page,
}) => {
  await page.goto(DONE)

  const breadcrumb = page.getByRole('navigation', { name: '현재 위치' })
  await expect(breadcrumb.getByText('회의', { exact: true })).toBeVisible()
  await expect(breadcrumb.getByText('체육대회 안전 관리 최종 회의')).toBeVisible()

  // 상태 이름도 색도 명세에 없다 — 서버가 준 글이 그대로 딱지에 그려진다.
  // 딱지가 둘인 것은 서로 다른 사실 둘을 나란히 달기 때문이다.
  const banner = page.locator('[data-node-id="20:2197"]')
  await expect(banner.getByText('회의록 정리가 완료되었습니다')).toBeVisible()
  await expect(banner.getByText('완료', { exact: true })).toBeVisible()
  await expect(banner.getByText('15:07 참석', { exact: true })).toBeVisible()
  await expect(banner.getByText('2026.07.25 16:30 박해랑이 최종 정리했습니다.')).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/ops-meet-07.png`, fullPage: true })
})

test('OPS-MEET-07: 머리 카드는 어느 행사의 회의였고 언제 어디서 열렸는지를 말한다', async ({
  page,
}) => {
  await page.goto(DONE)

  const head = page.locator('[data-node-id="20:2213"]')
  await expect(head.getByText('2026 소프트웨어융합대학 체육대회')).toBeVisible()
  await expect(head.getByRole('heading', { name: '체육대회 안전 관리 최종 회의' })).toBeVisible()
  // 실제 진행 시각은 예정 일시와 다른 조각이다 — 끝난 뒤에만 온다.
  await expect(head.getByText('2026.07.25 15:00–16:12', { exact: true })).toBeVisible()
  await expect(head.getByText('학생회실 (A204)', { exact: true })).toBeVisible()

  // 값 타일은 카탈로그가 조각을 가진 둘만 그린다. '참석 3명'·'불참 1명'은
  // 두 수를 따로 담는 조각이 없어(attendanceResultNote는 한 줄로 이어 온다)
  // 명세가 가리키지 못하고, 화면이 세거나 지어내지도 않는다.
  await expect(page.locator('[data-node-id="20:2231"]').getByText('2건')).toBeVisible()
  await expect(page.locator('[data-node-id="20:2236"]').getByText('없음')).toBeVisible()
})

// 끝난 회의의 안건이 갖는 것은 순서·제목·본문·확정된 결정뿐이다. 상태도 예상
// 소요도 오지 않는다 — 출처는 하나이고 그 단계에 없는 조각이 오지 않을 뿐이다.
test('OPS-MEET-07: 안건마다 확정된 결정을 붙이고, 없는 안건에는 그 칸이 없다', async ({
  page,
}) => {
  await page.goto(DONE)

  const first = page.locator('[data-node-id="20:2248"]')
  await expect(first.getByText('행사장 안전 점검 결과')).toBeVisible()
  await expect(
    first.getByText('본부석 뒤편 전선 구간에 케이블 커버를 추가하고 우천 시 실내 대기 장소를 사용하기로 했습니다.'),
  ).toBeVisible()
  await expect(first.getByText('확정된 결정', { exact: true })).toBeVisible()
  await expect(first.getByText('본부석 뒤편 전선 구간에 케이블 커버를 설치합니다.')).toBeVisible()

  await expect(page.getByText('비상 연락망은 운영본부를 중심으로 단일화합니다.')).toBeVisible()

  // 세 번째 안건에는 결정이 오지 않는다. 오지 않은 자리에 '아직 없습니다'를
  // 그리면 그것은 디자인에 없는 카피가 된다 — 결정 상자가 둘뿐이어야 한다.
  await expect(page.getByText('출입구, 경기장, 대기 구역별 담당 인원을 배치합니다.')).toBeVisible()
  await expect(page.getByText('확정된 결정', { exact: true })).toHaveCount(2)
})

test('OPS-MEET-07: 전체 요약은 안건별 기록과 다른 물건이라 따로 온다', async ({ page }) => {
  await page.goto(DONE)

  const minutes = page.locator('[data-node-id="20:2243"]')
  await expect(minutes.getByRole('heading', { name: '회의 핵심 요약' })).toBeVisible()
  await expect(
    minutes.getByText('체육대회 안전 점검 결과를 바탕으로 위험 구간 조치 방안을 확정했습니다.', {
      exact: false,
    }),
  ).toBeVisible()
})

test('OPS-MEET-07: 참석 결과는 시각까지 붙은 완성된 딱지로 온다', async ({ page }) => {
  await page.goto(DONE)

  const people = page.locator('[data-node-id="20:2293"]')
  await expect(people.getByRole('listitem')).toHaveCount(4)
  // 화면이 시각과 상태를 잇지 않는다 — 잇는 방법이 명세의 일이 되어 버린다.
  await expect(
    people.getByRole('listitem').filter({ hasText: '박해랑' }).getByText('15:00 참석'),
  ).toBeVisible()
  await expect(
    people.getByRole('listitem').filter({ hasText: '김민준' }).getByText('불참', { exact: true }),
  ).toBeVisible()
})

// 받아 가는 것은 서버의 파일이다. pending으로 적으면 '아직 안 정했다'는 뜻이
// 되어 조용한 대체가 된다 — 여기는 정해져 있고, 명세가 아는 것은 어느 파일인가까지다.
test('OPS-MEET-07: 회의록과 자료를 받아 가는 자리는 아무 일도 안 하지 않는다', async ({
  page,
}) => {
  await page.goto(DONE)

  await page.getByRole('button', { name: '회의록 내보내기' }).click()
  await expect(page.getByRole('status')).toContainText('회의록 내보내기')

  const documents = page.locator('[data-node-id="20:2317"]')
  await expect(documents.getByRole('listitem')).toHaveCount(3)
  await expect(documents.getByText('체육대회_안전점검표.pdf')).toBeVisible()

  await documents.getByRole('button', { name: '내려받기' }).first().click()
  await expect(page.getByRole('status')).toContainText('체육대회_안전점검표.pdf')
})

// 와이어프레임은 후속 업무를 0건 빈 상태로만 그렸다. 무엇으로 이루어지는지도,
// 눌러서 어디로 가는지도 그림이 말하지 않는다.
test('OPS-MEET-07: 후속 업무는 아직 없다고 말한다', async ({ page }) => {
  await page.goto(DONE)

  const header = page.locator('[data-node-id="20:2286"]')
  await expect(header.getByRole('heading', { name: '후속 업무 진행 현황' })).toBeVisible()
  await expect(header.getByText('없음', { exact: true })).toBeVisible()

  await expect(
    page
      .locator('[data-node-id="20:2291"]')
      .getByText('회의록 정리에서 생성한 후속 업무 카드가 여기에 표시됩니다.'),
  ).toBeVisible()
})

// 08은 변형이라 주소가 없다. 확인을 요구하는 자리는 불참자에게만 그려지므로
// 참석자의 화면에는 없어야 한다 — 있으면 둘을 변형으로 가른 이유가 무너진다.
test('OPS-MEET-07: 불참자에게만 있는 자리는 여기 없다', async ({ page }) => {
  await page.goto(DONE)

  await expect(page.getByRole('button', { name: '회의 요약 확인 완료' })).toHaveCount(0)
  await expect(page.getByText('나에게 배정된 후속 업무', { exact: true })).toHaveCount(0)
})

test('OPS-MEET-07: 회의 id가 없으면 아무 회의록이나 대신 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/OPS-MEET-07')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('OPS-MEET-07', 'meetingId'))
  await expect(page.locator('[data-node-id="20:2197"]')).toHaveCount(0)
})

test('OPS-MEET-07: 없는 회의 id는 조용히 다른 회의로 대신하지 않는다', async ({ page }) => {
  await page.goto('/#/OPS-MEET-07?meetingId=MTG-없는것')

  await expect(page.getByRole('alert')).toContainText('회의를 찾을 수 없습니다')
  await expect(page.locator('[data-node-id="20:2197"]')).toHaveCount(0)
})

test('OPS-MEET-08: 참석하지 않은 사람은 제목부터 다르다', async ({ page }) => {
  await page.goto(DONE_ABSENT)

  await expect(page.getByRole('heading', { name: '회의 요약 확인' })).toBeVisible()
  // 참석한 사람이 받는 단추는 오지 않는다. 자리는 하나이고 오는 것이 다르다.
  await expect(page.getByRole('button', { name: '회의록 내보내기' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '회의 요약 확인 완료' })).toBeVisible()
})

test('OPS-MEET-08: 나에게 배정된 후속 업무가 한 칸 더 붙는다', async ({ page }) => {
  await page.goto(DONE_ABSENT)

  const mine = page.locator('[data-node-id="20:2553"]')
  await expect(mine).toContainText('나에게 배정된 후속 업무')
  // 비었을 때 하는 말이 07과 다르다 — 그래서 다른 물음이고 다른 출처다.
  await expect(page.getByText('나에게 배정된 미완료 후속 업무가 없습니다.')).toBeVisible()
})

test('OPS-MEET-08: 확인을 눌러도 그 뒤가 정해지지 않았다고 남긴다', async ({ page }) => {
  await page.goto(DONE_ABSENT)

  await page.getByRole('button', { name: '회의 요약 확인 완료' }).click()

  await expect(page.getByRole('status').first()).toContainText(
    successNoteAt('OPS-MEET-08', '20:2449'),
  )
})
