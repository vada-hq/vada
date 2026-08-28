import { expect, test } from '@playwright/test'
import { missingNoteOf, pendingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const LIVE = '/#/OPS-MEET-05A?meetingId=MTG-04'
// 같은 회의를 진행할 수 있는 사람이 본 그림(변형 OPS-MEET-05B). **다른 주소가
// 아니다** — 실제로는 데이터가 가른다(meeting.detail의 canEnd).
const LIVE_HOST = '/#/OPS-MEET-05B?meetingId=MTG-04'

// 진행 중 회의(OPS-MEET-05A).
//
// 이 그림도 보는 사람에 따라 갈린다(05A 일반 참가자 · 05B 진행 권한자). 주소는
// 하나이므로 여기서 확인하는 것은 **둘이 함께 갖는 자리**와, 일반 참가자에게는
// 회의를 진행하는 조작이 하나도 없다는 사실이다.

test('OPS-MEET-05A: 회의가 지금 어떤지를 머리에 모아 보여준다', async ({ page }) => {
  await page.goto(LIVE)

  const breadcrumb = page.getByRole('navigation', { name: '현재 위치' })
  await expect(breadcrumb.getByText('회의', { exact: true })).toBeVisible()
  await expect(breadcrumb.getByText('체육대회 안전 관리 최종 회의')).toBeVisible()

  // 보는 사람과 이 회의의 관계. 머리 오른쪽은 한 자리이고 무엇이 오는지는
  // 서버가 정한다 — 05B에서는 같은 자리에 '회의 종료'가 온다.
  await expect(
    page.locator('[data-node-id="20:961"]').getByText('참석 처리됨 · 15:07 참가'),
  ).toBeVisible()

  // 상태 이름도 색도 데이터가 준다. '진행 27분'은 사람이 아무것도 안 해도 자라는
  // 값이라 서버가 준 그대로 그리고 화면이 다시 세지 않는다.
  const strip = page.locator('[data-node-id="20:967"]')
  await expect(strip.getByText('진행 중', { exact: true })).toBeVisible()
  await expect(strip.getByText('15:00 시작', { exact: true })).toBeVisible()
  await expect(strip.getByText('진행 27분', { exact: true })).toBeVisible()
  await expect(strip.getByText('학생회실 (A204)', { exact: true })).toBeVisible()
  await expect(strip.getByText('3명 참가 중', { exact: true })).toBeVisible()
  await expect(strip.getByText('/ 초대 4명', { exact: true })).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/ops-meet-05a.png`, fullPage: true })
})

// 본문이 그리는 것은 지금 진행 중인 안건 하나다. 어느 것인지는 데이터가 안다
// (meeting.agendas의 isCurrent) — 화면이 순서로 짐작하지 않는다.
test('OPS-MEET-05A: 지금 진행 중인 안건 하나를 본문에 펼친다', async ({ page }) => {
  await page.goto(LIVE)

  const agenda = page.locator('[data-node-id="20:995"]')
  await expect(agenda.getByText('안건 2', { exact: true })).toBeVisible()
  await expect(agenda.getByText('진행 중', { exact: true })).toBeVisible()
  await expect(agenda.getByText('예상 15분', { exact: true })).toBeVisible()
  await expect(agenda.getByText('비상 연락망 및 담당자 확정')).toBeVisible()
  await expect(agenda.getByText('상황별 최초 연락 담당자와 보고 순서를 확정합니다.')).toBeVisible()

  // 사전 자료는 회의에 한 번 붙어 오고 어느 안건의 것인지는 그 조각이 안다.
  // 다른 안건의 자료는 이 자리에 오지 않는다.
  const documents = page.locator('[data-node-id="20:1007"]')
  await expect(documents.getByText('비상연락망_초안.xlsx')).toBeVisible()
  await expect(documents.getByText('체육대회_안전점검표.pdf')).toHaveCount(0)

  // 자료를 여는 것은 받아 가는 일이다 — pending이 아니라 download다.
  await expect(page.getByRole('button', { name: '열기' })).toBeVisible()
})

// 회의록 본문은 여러 줄을 받는 칸이다. 보내는 단추가 그림에 없고(자동 저장)
// 그 계약이 아직 없으므로 값은 이 화면 안에만 머문다.
test('OPS-MEET-05A: 논의 내용을 여러 줄로 받는다', async ({ page }) => {
  await page.goto(LIVE)

  const header = page.locator('[data-node-id="20:1019"]')
  await expect(header.getByText('논의 내용')).toBeVisible()
  await expect(header.getByText('참가자가 함께 작성하는 안건별 회의 기록')).toBeVisible()
  await expect(header.getByText('공동 작성 중')).toBeVisible()

  const box = page.locator('[data-node-id="20:1043"]')
  await expect(box).toHaveJSProperty('tagName', 'TEXTAREA')
  await box.fill('현장 담당자부터 순서대로 연락하기로 했습니다.')
  await expect(box).toHaveValue('현장 담당자부터 순서대로 연락하기로 했습니다.')

  await expect(
    page.locator('[data-node-id="20:1045"]').getByText('15:24 정하늘 수정 · 자동 저장됨'),
  ).toBeVisible()
})

// 결정과 후속 업무는 회의가 아니라 **안건**에 붙는다.
test('OPS-MEET-05A: 이 안건의 결정과 후속 업무를 함께 보여준다', async ({ page }) => {
  await page.goto(LIVE)

  await expect(
    page
      .locator('[data-node-id="20:1071"]')
      .getByText('비상 연락은 현장 담당자 → 운영본부 → 학생회장·학교 안전관리팀 순으로 진행합니다.'),
  ).toBeVisible()

  const followUp = page.locator('[data-node-id="20:1089"]')
  await expect(followUp.getByText('비상 연락망 최종본 배포')).toBeVisible()
  await expect(followUp.getByText('정하늘 · 07.23까지 · 위 결정사항에서 생성')).toBeVisible()
})

// 안건 목록은 셋을 다 보여주고 어느 것이 지금인지를 데이터로 가른다.
test('OPS-MEET-05A: 안건 목록과 참가 현황을 곁에 세운다', async ({ page }) => {
  await page.goto(LIVE)

  await expect(
    page.locator('[data-node-id="20:1105"]').getByText('2 / 3번째 안건 선택'),
  ).toBeVisible()

  const agendas = page.locator('[data-node-id="20:1110"]')
  await expect(agendas.getByRole('listitem')).toHaveCount(3)
  // 안건 상태는 셋이 서로 다르다. 이름도 색도 명세가 아니라 데이터가 준다.
  await expect(agendas.getByText('논의 완료', { exact: true })).toBeVisible()
  await expect(agendas.getByText('대기', { exact: true })).toBeVisible()
  await expect(agendas.getByText('결정 1', { exact: true }).first()).toBeVisible()

  const people = page.locator('[data-node-id="20:1154"]')
  await expect(people.getByRole('listitem')).toHaveCount(4)
  const absent = people.getByRole('listitem').filter({ hasText: '김민준' })
  await expect(absent.getByText('미참석', { exact: true })).toBeVisible()
  await expect(
    people.getByRole('listitem').filter({ hasText: '박해랑' }).getByText('15:00 참가'),
  ).toBeVisible()
})

// 일반 참가자에게는 회의를 진행하는 조작이 하나도 없다. '회의 종료'·'이 안건
// 논의 완료'·'다음 안건 시작'·'내용 수정'은 05B의 것이고, 그 사실이 둘을 변형으로
// 가른 이유다. 여기 남은 단추는 전부 갈 곳이 그려지지 않아 pending이다.
test('OPS-MEET-05A: 진행 조작은 두지 않고, 갈 곳 없는 단추는 모른다고 말한다', async ({
  page,
}) => {
  await page.goto(LIVE)

  await expect(page.getByRole('button', { name: '회의 종료' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '이 안건 논의 완료' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '다음 안건 시작' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '내용 수정' })).toHaveCount(0)

  await page.getByRole('button', { name: '결정 의견 추가' }).click()
  await expect(page.getByRole('status')).toContainText(
    pendingNoteOf('OPS-MEET-05A', '결정 의견 추가'),
  )

  await page.getByRole('button', { name: '업무 만들기' }).click()
  await expect(page.getByRole('status')).toContainText(
    pendingNoteOf('OPS-MEET-05A', '업무 만들기'),
  )
})

test('OPS-MEET-05A: 회의 id가 없으면 아무 회의나 대신 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/OPS-MEET-05A')

  await expect(page.getByRole('alert')).toContainText(
    missingNoteOf('OPS-MEET-05A', 'meetingId'),
  )
  await expect(page.locator('[data-node-id="20:967"]')).toHaveCount(0)
})

test('OPS-MEET-05A: 진행할 수 없는 사람에게는 회의를 움직이는 단추가 없다', async ({
  page,
}) => {
  await page.goto(LIVE)

  for (const name of ['회의 종료', '이 안건 논의 완료', '다음 안건 시작', '내용 수정']) {
    await expect(page.getByRole('button', { name })).toHaveCount(0)
  }
  // 결정을 더하는 단추는 있지만 글이 다르다 — 의견을 내는 것과 결정을 적는 것은
  // 다른 일이다.
  await expect(page.getByRole('button', { name: '결정 의견 추가' })).toBeVisible()
})

test('OPS-MEET-05B: 진행하는 사람은 안건을 닫고 다음으로 넘기고 회의를 끝낸다', async ({
  page,
}) => {
  await page.goto(LIVE_HOST)

  await expect(page.getByRole('button', { name: '이 안건 논의 완료' })).toBeVisible()
  await expect(page.getByRole('button', { name: '다음 안건 시작' })).toBeVisible()
  await expect(page.getByRole('button', { name: '내용 수정' })).toBeVisible()
  // 같은 자리에 다른 글이 온다.
  await expect(page.getByRole('button', { name: '결정 추가' })).toBeVisible()
  await expect(page.getByRole('button', { name: '결정 의견 추가' })).toHaveCount(0)

  await page.getByRole('button', { name: '회의 종료' }).click()
  await expect(page).toHaveURL(/#\/OPS-MEET-D02\?meetingId=MTG-04/)
})
