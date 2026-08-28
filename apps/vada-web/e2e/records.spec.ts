import { expect, test } from '@playwright/test'
import { missingNoteOf, successNoteAt } from './spec'

const SHOTS = 'e2e/shots'
const COMPLETED = '/#/REC-01'
const ARCHIVE = '/#/REC-02?eventId=E-REC-01'
const ARCHIVE_WRITE = '/#/REC-02A?eventId=E-REC-03'

// 기록 갈래 셋(REC-01 · REC-02 · REC-02A).
//
// **REC-01의 카드 셋이 나머지 둘의 머리와 같은 세 건이다.** 봄 축제(발행 v1.0) ·
// 2025 종강(검토 중) · 2025 신입생 환영회(미발행). 첫째가 REC-02로 열리고,
// 셋째의 자리에는 단추 대신 '아직 발행되지 않았다'는 글이 온다.
//
// **REC-02A로 들어가는 문이 그림에 없다.** 아카이브를 쓰는 화면인데 목록의 어느
// 카드도 그리로 가지 않는다 — 셋째 카드가 그 주인인데 단추가 없다. 이 파일은
// 그 사실을 단언한다(주소로 직접 연다). 이으려면 그림이 먼저 말해야 한다.

// ── 셸 ──────────────────────────────────────────────────────────────────────

test('셸의 기록 메뉴가 완료된 행사를 가리킨다', async ({ page }) => {
  await page.goto('/#/HOME-01K')

  const menu = page.getByRole('navigation', { name: '주요 메뉴' })
  await menu.getByRole('button', { name: '기록', exact: true }).click()

  await expect(page).toHaveURL(/#\/REC-01$/)
  await expect(page.getByRole('heading', { name: '완료된 행사', level: 1 })).toBeVisible()
})

// 메뉴가 가리키는 화면 자신은 activeNavigationScreenId를 갖지 않고, 그 아래로
// 들어가는 둘은 갖는다. 셋 다 같은 칸이 켜져야 한다.
test('기록 갈래 셋이 모두 기록 메뉴를 켠다', async ({ page }) => {
  for (const url of [COMPLETED, ARCHIVE, ARCHIVE_WRITE]) {
    await page.goto(url)
    await expect(
      page
        .getByRole('navigation', { name: '주요 메뉴' })
        .getByRole('button', { name: '기록', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
  }
})

// ── REC-01 · 완료된 행사 ────────────────────────────────────────────────────

test('REC-01: 완료된 행사 셋과 미발행 알림이 그려진다', async ({ page }) => {
  await page.goto(COMPLETED)

  // 몇 건이 미발행인지는 서버가 세고 화면은 그 문구를 그린다.
  await expect(page.getByText('인수인계 문서 미발행 2건')).toBeVisible()

  await expect(page.getByText('봄 축제 학생회 부스')).toBeVisible()
  await expect(page.getByText('2025 학년도 종강 행사')).toBeVisible()
  await expect(page.getByText('2025 신입생 환영회')).toBeVisible()

  // 아카이브 딱지의 색 이름은 데이터가 준다 — 셋이 서로 다른 단계다.
  await expect(page.getByText('발행 v1.0')).toBeVisible()
  await expect(page.getByText('검토 중')).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/rec-01.png`, fullPage: true })
})

// 갈 곳이 없는 카드에는 단추가 오지 않는다. **없는 것이 표현이 아니라 뜻이다** —
// 명세가 늘 그리라고 하면 발행되지 않은 문서에도 '상세 보기'가 생긴다.
test('REC-01: 미발행 행사에는 단추 대신 그 까닭이 온다', async ({ page }) => {
  await page.goto(COMPLETED)

  await expect(page.getByText('인수인계 문서가 아직 발행되지 않았습니다')).toBeVisible()
  await expect(page.getByRole('button', { name: '상세 보기' })).toHaveCount(2)
})

test('REC-01: 상세 보기는 그 행사의 아카이브로 데려간다', async ({ page }) => {
  await page.goto(COMPLETED)

  await page.getByRole('button', { name: '상세 보기' }).first().click()

  await expect(page).toHaveURL(/#\/REC-02\?eventId=E-REC-01/)
  // 넘긴 값이 저쪽에서 무엇을 집어 오는지까지 본다.
  await expect(page.getByRole('heading', { name: '봄 축제 학생회 부스' })).toBeVisible()
})

// 목록은 받아온 것을 화면에서 거르지 않는다 — 검색어가 바뀌면 다시 조회한다.
test('REC-01: 행사명으로 목록을 좁힌다', async ({ page }) => {
  await page.goto(COMPLETED)

  await page.getByRole('searchbox', { name: '행사명 검색' }).fill('종강')

  await expect(page.getByText('2025 학년도 종강 행사')).toBeVisible()
  await expect(page.getByText('봄 축제 학생회 부스')).toHaveCount(0)
})

// ── REC-02 · 행사 아카이브 ──────────────────────────────────────────────────

// **발행 여부가 갈 곳을 정한다.** 발행된 문서는 읽는 화면으로, 아직 발행되지 않은
// 것은 쓰고 검토받는 화면으로 간다 — 그것이 REC-02A로 들어가는 문이다.
// 갈래를 가르는 것은 열쇠이지 딱지에 그려진 말이 아니다.
test('REC-01: 발행된 문서와 검토 중인 문서가 서로 다른 화면으로 간다', async ({ page }) => {
  await page.goto(COMPLETED)

  const open = page.getByRole('button', { name: '상세 보기' })

  await open.first().click()
  await expect(page).toHaveURL(/#\/REC-02\?eventId=E-REC-01/)

  await page.goto(COMPLETED)
  await page.getByRole('button', { name: '상세 보기' }).nth(1).click()
  await expect(page).toHaveURL(/#\/REC-02A\?eventId=E-REC-02/)
})

test('REC-02: 발행된 문서의 머리와 본문이 그려진다', async ({ page }) => {
  await page.goto(ARCHIVE)

  // 누가 언제 쓰고 검토했는지는 서버가 완성한 문장으로 온다 — 역할 이름을
  // 명세가 들면 역할이 하나 늘 때마다 명세가 틀린다.
  await expect(page.getByText('검토 김바다 (회장단)')).toBeVisible()

  // 라벨이 고정된 열세 조각(개요 다섯 · 성과 넷 · 현장 운영 넷).
  await expect(page.getByText('행사 목표')).toBeVisible()
  await expect(page.getByText('신청 대비 참석')).toBeVisible()
  await expect(page.getByText('실제 진행 순서')).toBeVisible()

  // 수치가 발행 시점의 것이라는 말은 화면이 아니라 명세가 갖는다.
  await expect(
    page.getByText('위 수치는 발행 시점 기준입니다.', { exact: false }),
  ).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/rec-02.png`, fullPage: true })
})

// 목차는 이름만 그린다. **화면 안의 구역으로 데려가는 동작에 어휘가 없어서다** —
// navigate는 다른 화면으로 가는 것이고 pending은 '아직 안 정했다'라 거짓말이 된다.
// 지어낸 단추를 두는 대신 누르는 자리를 만들지 않는다.
test('REC-02: 목차는 절의 이름만 그리고 누르는 자리가 아니다', async ({ page }) => {
  await page.goto(ARCHIVE)

  const toc = page.getByRole('navigation', { name: '목차' })
  await expect(toc.getByText('개요')).toBeVisible()
  await expect(toc.getByText('잘된 점')).toBeVisible()
  await expect(toc.getByRole('button')).toHaveCount(0)
})

// 원본은 지금도 행사 공간에 그대로 있다. 어느 화면으로 가는지는 데이터가 준
// 열쇠(targetKind)로 명세가 정한다 — 데이터가 화면 이름을 직접 주지 않는다.
test('REC-02: 근거 자료의 원본 보기가 행사 업무 보드로 데려간다', async ({ page }) => {
  await page.goto(ARCHIVE)

  await page.getByRole('button', { name: '원본 보기' }).first().click()

  await expect(page).toHaveURL(/#\/EVT-TASK-01\?eventId=E-REC-01/)
})

// 체크는 명세가 말한 자리(archiveChecklistDraft)에 담긴다. **저장 단추가 그림에
// 없어 아무 데도 보내지 않는다** — 언제 저장되는지는 그림이 말해야 한다.
test('REC-02: 인수인계 체크는 눌린 채로 남는다', async ({ page }) => {
  await page.goto(ARCHIVE)

  const check = page.getByRole('checkbox', { name: '장소 사용 승인 절차 확인' })
  await check.check()
  await expect(check).toBeChecked()
})

test('REC-02: 어느 행사인지 없이 열면 그 사실을 드러낸다', async ({ page }) => {
  await page.goto('/#/REC-02')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('REC-02', 'eventId'))
})

// ── REC-02A · 아카이브 작성·검토 ────────────────────────────────────────────

test('REC-02A: 자동으로 채워지는 부분과 직접 쓰는 부분이 갈려 그려진다', async ({
  page,
}) => {
  await page.goto(ARCHIVE_WRITE)

  await expect(page.getByText('자동 채움 영역')).toBeVisible()
  await expect(page.getByText('행사 데이터 기준 · 편집 불가')).toBeVisible()

  // 직접 쓰는 것은 셋이다. 배너가 그 사실을 적어 두었다.
  await expect(
    page.getByRole('textbox', { name: '현장 운영', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('textbox', { name: '잘된 점' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '다음 담당자' })).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/rec-02a.png`, fullPage: true })
})

// **발행 단추가 그림에 없다.** 조건 여섯과 '조건을 모두 충족해야 발행할 수
// 있습니다.'는 그려져 있는데 누를 자리가 없다. 지어내지 않는다.
test('REC-02A: 발행 조건은 그려지지만 발행하는 단추는 없다', async ({ page }) => {
  await page.goto(ARCHIVE_WRITE)

  await expect(page.getByText('0 / 6')).toBeVisible()
  await expect(page.getByText('조건을 모두 충족해야 발행할 수 있습니다.')).toBeVisible()
  await expect(page.getByRole('button', { name: /발행/ })).toHaveCount(0)
})

// 무엇이 모자란지는 조직의 규칙이라 화면이 셀 수 없다(executeWhen: sourceAllows).
// 화면이 하는 일은 서버가 준 까닭을 그대로 내놓는 것뿐이다.
test('REC-02A: 조건을 못 채우면 검토 요청이 서버가 준 까닭을 내놓는다', async ({
  page,
}) => {
  await page.goto(ARCHIVE_WRITE)

  await page.getByRole('button', { name: '검토 요청' }).click()

  await expect(page.getByRole('status')).toContainText('직접 작성하는 부분')
})

// 보낸 뒤가 아직 정해지지 않았다는 글도 명세가 갖는다 — 검사가 옮겨 적으면 두 벌이 된다.
test('REC-02A: 임시 저장은 실제로 보낸다', async ({ page }) => {
  await page.goto(ARCHIVE_WRITE)

  await page.getByRole('textbox', { name: '잘된 점' }).fill('접수 동선이 매끄러웠다')
  await page.getByRole('button', { name: '임시 저장' }).click()

  // 같은 글이 둘이다 — 단추 자신이 보내는 중임을 말하고, 그 아래 상태 줄도
  // 같은 말을 한다. 화면이 옳으므로 자리를 짚는다.
  await expect(page.getByRole('status')).toHaveText('임시 저장하는 중입니다')
})

// AI 초안이 무엇을 하고 무엇을 하지 않는지는 **화면에 적힌 그 글이 곧 계약이다**.
// 명세가 그 문장을 들면 계약이 바뀔 때 명세가 틀린다.
test('REC-02A: AI 초안의 계약 문장이 단추 곁에 그려진다', async ({ page }) => {
  await page.goto(ARCHIVE_WRITE)

  await expect(
    page.getByText('기록에 없는 자산·연락처·담당자를 새로 만들지 않습니다', {
      exact: false,
    }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'AI 초안 생성' })).toBeVisible()
})

// 검토 의견은 검토자가 적는다 — 쓰는 사람의 칸이 아니다. 아직 없으면 그 자리를
// 말하는 것은 출처의 messages.empty다.
test('REC-02A: 검토 의견이 아직 없으면 출처의 빈 상태 글이 온다', async ({ page }) => {
  await page.goto(ARCHIVE_WRITE)

  await expect(page.getByText('검토 의견이 여기에 표시됩니다.')).toBeVisible()
})

test('REC-02A: 어느 행사인지 없이 열면 그 사실을 드러낸다', async ({ page }) => {
  await page.goto('/#/REC-02A')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('REC-02A', 'eventId'))
})

// 검토를 요청한 뒤 어디로 가는지는 그림이 말하지 않는다. 그 사실을 적어만 두고
// 아무도 안 보여주면 명세에만 있는 사실이 된다.
test('REC-02A: 보낸 뒤가 정해지지 않았다는 글이 명세에 있다', async () => {
  expect(successNoteAt('REC-02A', '30:4087')).toContain('디자인에 없습니다')
})
