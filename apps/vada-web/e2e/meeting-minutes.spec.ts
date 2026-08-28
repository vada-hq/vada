import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const MINUTES = '/#/OPS-MEET-06A?meetingId=MTG-06'

// 정리 중 회의(OPS-MEET-06A).
//
// 회의는 끝났고 회의록은 아직 정리 중이다. 이 그림도 보는 사람에 따라 갈린다
// (06A 일반 참가자 · 06B 진행 권한자). 주소는 하나이므로 여기서 확인하는 것은
// 일반 참가자가 보는 자리와, **이 화면에 고치는 조작이 하나도 없다**는 사실이다.

test('OPS-MEET-06A: 회의록이 정리 중이라는 것을 머리와 띠가 함께 말한다', async ({ page }) => {
  await page.goto(MINUTES)

  const breadcrumb = page.getByRole('navigation', { name: '현재 위치' })
  await expect(breadcrumb.getByText('회의', { exact: true })).toBeVisible()
  await expect(breadcrumb.getByText('신입생 환영 행사 기획회의')).toBeVisible()

  // 머리 오른쪽은 한 자리다. 여기서는 읽기만 하는 화면이라는 표시가 오고,
  // 06B에서는 같은 자리에 '정리 완료'가 온다.
  await expect(page.locator('[data-node-id="20:1584"]')).toContainText('읽기 전용')

  // 띠의 제목·본문·색 이름은 서버가 준다. 딱지가 둘인 것은 서로 다른 사실 둘이기
  // 때문이다 — 회의가 어디까지 왔는가와 이 사람이 참석했는가.
  const banner = page.locator('[data-node-id="20:1592"]')
  await expect(banner.getByText('회의록을 정리하고 있습니다')).toBeVisible()
  await expect(banner.getByText('정리 중', { exact: true })).toBeVisible()
  await expect(banner.getByText('15:07 참석', { exact: true })).toBeVisible()
  await expect(
    banner.getByText('현재 내용은 진행 권한자가 수정할 수 있습니다. 정리 완료 후 최종 회의록으로 제공됩니다.'),
  ).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/ops-meet-06a.png`, fullPage: true })
})

// 끝난 회의라 예정 일시가 아니라 **실제로 언제 했는지**가 온다. 시각과 장소는
// 서버가 각각 완성해 보내고 화면은 잇기만 한다.
test('OPS-MEET-06A: 어느 행사의 무슨 회의였는지를 머리 카드가 말한다', async ({ page }) => {
  await page.goto(MINUTES)

  const card = page.locator('[data-node-id="20:1609"]')
  await expect(card.getByText('신입생 환영 행사', { exact: true })).toBeVisible()
  await expect(card.getByText('신입생 환영 행사 기획회의', { exact: true })).toBeVisible()
  await expect(card.getByText('2026.07.15 16:00–17:18', { exact: true })).toBeVisible()
  await expect(card.getByText('온라인 (Discord)', { exact: true })).toBeVisible()
})

// 전체 요약은 아직 초안이다. 확정된 글이 아니라는 것도 서버가 말한다.
test('OPS-MEET-06A: 전체 요약이 아직 초안임을 함께 보여준다', async ({ page }) => {
  await page.goto(MINUTES)

  const draft = page.locator('[data-node-id="20:1634"]')
  await expect(draft.getByText('회의 요약 초안')).toBeVisible()
  await expect(draft.getByText('정리 중 · 변경될 수 있음')).toBeVisible()
  await expect(
    draft.getByText(
      '신입생 환영 행사 프로그램 순서와 부서별 준비 범위를 논의했습니다. 장소 답사 후 세부 동선과 무대 운영 계획을 최종 확정할 예정입니다.',
    ),
  ).toBeVisible()
})

// 안건이 갖는 것은 단계마다 다르다. 정리 중에는 정리 상태와 한 줄 요약이 오고,
// 논의 내용과 결정 편집은 06B의 것이다. 상태 이름도 색도 데이터가 준다.
test('OPS-MEET-06A: 안건마다 정리 상태와 한 줄 요약을 보여준다', async ({ page }) => {
  await page.goto(MINUTES)

  const first = page.locator('[data-node-id="20:1642"]')
  await expect(first.getByText('1', { exact: true })).toBeVisible()
  await expect(first.getByText('행사 프로그램 구성')).toBeVisible()
  await expect(first.getByText('정리됨', { exact: true })).toBeVisible()
  await expect(
    first.getByText('환영 인사, 학과 소개, 아이스브레이킹, 부서별 교류 순으로 진행합니다.'),
  ).toBeVisible()

  // 안건마다 상태가 다르다. 아직 정리 중인 안건이 있다는 것이 이 화면의 요점이다.
  // 요약 문장에도 같은 말이 들어 있어 정확히 짚는다.
  await expect(page.getByText('부서별 준비 범위', { exact: true })).toBeVisible()
})

// 오른쪽 기둥. 확정된 결정은 회의가 아니라 안건에 붙는다.
test('OPS-MEET-06A: 확정된 결정과 참석 기록 안내를 곁에 세운다', async ({ page }) => {
  await page.goto(MINUTES)

  await expect(page.locator('[data-node-id="20:1674"]')).toHaveText('현재 정리 현황')

  const decisions = page.locator('[data-node-id="20:1697"]')
  await expect(decisions.getByText('확정된 결정')).toBeVisible()
  await expect(
    decisions.getByText('프로그램 순서는 환영 인사 이후 학과 소개와 교류 프로그램 순으로 진행합니다.'),
  ).toBeVisible()

  await expect(page.locator('[data-node-id="20:1704"]')).toHaveText(
    '참석 기록은 이미 확정되어 있습니다. 이 화면을 다시 열거나 닫아도 참석 상태는 달라지지 않습니다.',
  )
})

// 일반 참가자에게는 회의록을 고치는 조작이 하나도 없다. '정리 완료'·'AI로 전체
// 요약 만들기'·'직접 작성'·'업무 연결'은 06B의 것이고, 그 사실이 둘을 변형으로
// 가른 이유다. 이 화면에는 누를 것 자체가 없다.
test('OPS-MEET-06A: 정리하는 조작은 하나도 두지 않는다', async ({ page }) => {
  await page.goto(MINUTES)

  await expect(page.getByRole('button', { name: '정리 완료' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'AI로 전체 요약 만들기' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '직접 작성' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '업무 연결' })).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('checkbox')).toHaveCount(0)
})

test('OPS-MEET-06A: 회의 id가 없으면 아무 회의나 대신 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/OPS-MEET-06A')

  await expect(page.getByRole('alert')).toContainText(
    missingNoteOf('OPS-MEET-06A', 'meetingId'),
  )
  await expect(page.locator('[data-node-id="20:1592"]')).toHaveCount(0)
})
