import { expect, test } from '@playwright/test'
import { pendingNoteAt } from './spec'

const SHOTS = 'e2e/shots'
const CALENDAR = '/#/OPS-CAL-01'
const INVITE = '/#/INV-00'

// 운영 캘린더(OPS-CAL-01)와 초대 코드 입력(INV-00).
//
// 한 파일에 둘을 담는 이유는 둘 다 **작은 읽기·입력 화면 하나씩**이고, 이 회차에
// 함께 만들어졌기 때문이다. 서로를 부르지는 않는다.
//
// 캘린더는 읽기 전용이다 — 바닥 글이 그것을 못 박는다. 그래서 이 파일이 지키는
// 것은 '무엇을 만들 수 있나'가 아니라 **무엇이 서버의 것이고 무엇이 화면의
// 것인가**다.

// ── OPS-CAL-01 · 운영 캘린더 ────────────────────────────────────────────────

test('캘린더는 운영 메뉴를 켠다', async ({ page }) => {
  await page.goto(CALENDAR)

  await expect(
    page
      .getByRole('navigation', { name: '주요 메뉴' })
      .getByRole('button', { name: '운영', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: '캘린더', level: 1 })).toBeVisible()
})

// 달 이름도 이번 주 범위도 화면이 셈하지 않는다. 어느 달을 보고 있는지·오늘이
// 언제인지를 아는 것은 서버뿐이다.
test('보고 있는 달과 이번 주 범위를 서버가 준 그대로 그린다', async ({ page }) => {
  await page.goto(CALENDAR)

  await expect(page.locator('[data-node-id="30:2110"]')).toHaveText('2026년 7월')
  const weekHeader = page.locator('[data-node-id="30:2363"]')
  await expect(weekHeader).toContainText('이번 주 일정')
  await expect(weekHeader).toContainText('07.19 (일) – 07.25 (토) · 오늘 07.19')

  // 오늘 칸만 채워진 동그라미다. 그 사실도 데이터가 준다(dayTone: today).
  await expect(page.locator('[data-node-id="30:2141"]').getByText('19', { exact: true })).toHaveClass(
    /bg-blue-600/,
  )
})

// 좁혀 보기는 조회 인자다 — 받아온 것을 화면에서 다시 거르지 않는다. 필터는
// 격자 위에 있고 이번 주 목록도 같은 조건으로 좁아진다.
test('유형 필터가 월 격자와 이번 주 목록을 함께 좁힌다', async ({ page }) => {
  await page.goto(CALENDAR)

  const grid = page.locator('[data-node-id="30:2141"]')
  const week = page.locator('[data-node-id="30:2368"]')

  await expect(grid.getByRole('button', { name: /체육대회 참가 신청 마감/ })).toBeVisible()
  await expect(grid.getByRole('button', { name: /정기 운영회의/ })).toBeVisible()

  await page.getByRole('radio', { name: '회의' }).click()

  await expect(grid.getByRole('button', { name: /정기 운영회의/ })).toBeVisible()
  await expect(grid.getByRole('button', { name: /체육대회 참가 신청 마감/ })).toHaveCount(0)
  await expect(week.getByText('정기 운영회의')).toBeVisible()
  await expect(week.getByText('체육대회 참가 신청 마감')).toHaveCount(0)
})

// 딱지를 눌러 원본을 여는 화면은 아직 없다. 그 사실을 명세가 들고 있고 검사는
// 읽기만 한다 — 옮겨 적으면 명세를 고쳤을 때 조용히 낡는다.
test('딱지를 누르면 원본 화면이 아직 없다고 알린다', async ({ page }) => {
  await page.goto(CALENDAR)

  await page
    .locator('[data-node-id="30:2141"]')
    .getByRole('button', { name: /체육대회 참가 신청 마감/ })
    .click()

  await expect(page.getByRole('status')).toHaveText(pendingNoteAt('OPS-CAL-01', '30:2141'))
})

// 줄마다 갈 곳이 있는 것은 아니다. 행사에 딸린 줄만 '행사 일정 보기'를 갖고,
// 그 줄은 **어느 행사인지를 함께 넘긴다** — 넘기지 않으면 저쪽은 무엇의 일정인지
// 모르는 채로 열린다.
test('이번 주 줄의 행사 일정 보기가 그 행사의 일정으로 데려간다', async ({ page }) => {
  await page.goto(CALENDAR)

  const week = page.locator('[data-node-id="30:2368"]')
  const rows = week.getByRole('listitem')
  await expect(rows).toHaveCount(9)
  // 아홉 줄 중 넷만 갈 곳이 있다.
  await expect(week.getByRole('button', { name: /행사 일정 보기/ })).toHaveCount(4)

  await week.getByRole('button', { name: /행사 일정 보기/ }).first().click()

  await expect(page).toHaveURL(/#\/EVT-SCHED-01\?eventId=E-01$/)
  await expect(
    page.getByRole('heading', { level: 1, name: '2026 소프트웨어융합대학 체육대회' }),
  ).toBeVisible()
})

test('바닥 글이 어디서 만드는지를 일러 준다', async ({ page }) => {
  await page.goto(CALENDAR)

  await expect(
    page.getByText('회의 생성은 운영 > 회의, 행사 일정은 각 행사의 일정 탭에서 관리합니다.'),
  ).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/ops-cal-01.png`, fullPage: true })
})

// ── INV-00 · 초대 코드 입력 ─────────────────────────────────────────────────

test('초대 코드 화면은 셸을 그리지 않는다', async ({ page }) => {
  await page.goto(INVITE)

  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '초대 코드를 입력해 주세요' })).toBeVisible()
})

test('코드 없이 확인하면 빈 칸을 짚고 머문다', async ({ page }) => {
  await page.goto(INVITE)

  await page.getByRole('button', { name: '학생회 확인' }).click()

  await expect(page.getByText('필수 항목입니다')).toBeVisible()
  await expect(page).toHaveURL(/#\/INV-00$/)
})

test('코드를 넣고 확인하면 초대받은 학생회 확인으로 간다', async ({ page }) => {
  await page.goto(INVITE)

  await page.getByRole('textbox', { name: '초대 코드*' }).fill('AB12CD34')
  await page.getByRole('button', { name: '학생회 확인' }).click()

  await expect(page).toHaveURL(/#\/INV-01$/)
  await expect(page.getByText('초대받은 학생회')).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/inv-00.png`, fullPage: true })
})

// 코드는 화면 안의 값이 아니라 onboardingDraft에 담긴다. 담기지 않으면 되돌아왔을
// 때 다시 쳐야 하고, 명세가 말한 흐름 수명이 거짓이 된다.
test('넣은 코드는 화면을 떠났다 와도 남는다', async ({ page }) => {
  await page.goto(INVITE)

  await page.getByRole('textbox', { name: '초대 코드*' }).fill('AB12CD34')
  await page.getByRole('button', { name: '학생회 확인' }).click()
  await expect(page).toHaveURL(/#\/INV-01$/)

  await page.goBack()

  await expect(page.getByRole('textbox', { name: '초대 코드*' })).toHaveValue('AB12CD34')
})

test('이전으로는 시작 방식 선택으로 돌아간다', async ({ page }) => {
  await page.goto(INVITE)

  await page.getByRole('button', { name: '이전으로' }).click()

  await expect(page).toHaveURL(/#\/ONB-02$/)
  await expect(page.getByRole('heading', { name: '어떻게 시작하시겠어요?' })).toBeVisible()
})

// 와이어프레임의 '→ 오류 예시: …' 넉 줄은 시연 장치다 — 가리키는 프레임이 저장소에
// 하나도 없다. 그리면 없는 기능이 계약에 들어가므로 그리지 않기로 했고, 그 결정이
// 조용히 뒤집히지 않게 여기서 지킨다(design/deviations.ts에 같은 이유가 적혀 있다).
test('오류 예시 넉 줄은 그리지 않는다', async ({ page }) => {
  await page.goto(INVITE)

  await expect(page.getByText('오류 예시')).toHaveCount(0)
})
