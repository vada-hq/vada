import { expect, test } from '@playwright/test'
import { pendingNoteAt } from './spec'

const SHOTS = 'e2e/shots'
const OVERVIEW = '/#/FIN-00'
// 예산을 편성할 수 있는 사람이 본 같은 화면(변형 FIN-00B). **다른 주소가 아니다** —
// 실제로는 데이터가 가르고(finance.overviewViewer의 canPlanBudget), 이 저장소에는
// 로그인한 사람이 없어 그림 이름이 그 자리를 대신한다.
const OVERVIEW_PLANNER = '/#/FIN-00B'
const LEDGER = '/#/FIN-LEDGER-01'

// 조직 전체 재정(FIN-00 · FIN-LEDGER-01).
//
// **행사 아래의 재정(FIN-REQ-* 여섯)과 다른 자리다.** 저쪽은 셸의 '운영'을 켜고
// 빵부스러기가 '운영 > 행사 > … > 재정'으로 시작한다. 이쪽은 사이드바의 '재정'을
// 켜고 '재정 > …'로 시작하며, 둘 사이에 그림이 그린 이음은 하나도 없다. 그 사실을
// 이 파일이 지킨다 — 이으면 FIN-REQ-02의 빵부스러기 여섯 조각이 통째로 거짓이 된다.

// ── 셸 ──────────────────────────────────────────────────────────────────────

test('셸의 재정 메뉴가 전체 재정 현황을 가리킨다', async ({ page }) => {
  await page.goto('/#/HOME-01K')

  const menu = page.getByRole('navigation', { name: '주요 메뉴' })
  await menu.getByRole('button', { name: '재정', exact: true }).click()

  await expect(page).toHaveURL(/#\/FIN-00$/)
  await expect(page.getByRole('heading', { name: '전체 재정 현황', level: 1 })).toBeVisible()
})

// 메뉴가 가리키는 화면 자신은 activeNavigationScreenId를 갖지 않고, 그 아래로
// 들어가는 화면은 갖는다. 둘 다 같은 칸이 켜져야 한다.
test('FIN-00과 사용 내역은 둘 다 재정 메뉴를 켠다', async ({ page }) => {
  for (const url of [OVERVIEW, LEDGER]) {
    await page.goto(url)
    await expect(
      page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('button', { name: '재정', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
  }
})

// ── FIN-00 · 전체 재정 현황 ─────────────────────────────────────────────────

// 금액도 집행률도 화면이 셈하지 않는다. 무엇을 실제 지출로 보고 무엇을 예정으로
// 보는지가 조직의 재정 규칙이므로 전부 서버가 준다.
test('FIN-00: 금액 넷과 집행률을 서버가 준 그대로 보여준다', async ({ page }) => {
  await page.goto(OVERVIEW)

  await expect(page.locator('[data-node-id="30:2576"]')).toContainText('30,000,000원')
  await expect(page.locator('[data-node-id="30:2589"]')).toContainText('12,400,000원')
  await expect(page.locator('[data-node-id="30:2602"]')).toContainText('3,100,000원')
  await expect(page.locator('[data-node-id="30:2616"]')).toContainText('14,500,000원')

  const execution = page.locator('[data-node-id="30:2629"]')
  await expect(execution).toContainText('전체 예산 집행률 41.3%')
  await expect(execution).toContainText('지출 예정 포함 51.7%')

  // 회계 기간과 기준일도 서버의 것이다.
  await expect(page.locator('[data-node-id="30:2559"]')).toContainText('2026년 1학기')

  await page.screenshot({ path: `${SHOTS}/fin-00.png`, fullPage: true })
})

// 나누는 축은 조회 인자다 — 받아온 것을 화면에서 다시 나누지 않는다.
test('FIN-00: 행사별과 부서별은 서로 다른 표를 불러온다', async ({ page }) => {
  await page.goto(OVERVIEW)

  const table = page.getByRole('table', { name: '구분별 예산 현황' })
  await expect(table).toContainText('체육대회')
  await expect(table).toContainText('가을 축제')

  await page.getByRole('tab', { name: '부서별' }).click()

  await expect(table).toContainText('기획부')
  await expect(table.getByText('가을 축제')).toHaveCount(0)
})

// 카드 둘이 '내역'이라는 같은 글을 단다. 하나는 갈 곳이 있고 하나는 아직 없다 —
// **아직 없는 것을 있는 척하지 않는다.**
test('FIN-00: 실제 지출의 내역은 사용 내역으로 데려간다', async ({ page }) => {
  await page.goto(OVERVIEW)

  await page.locator('[data-node-id="30:2589"]').click()

  await expect(page).toHaveURL(/#\/FIN-LEDGER-01\?stage=spent/)
  await expect(page.getByRole('heading', { name: '사용 내역', level: 1 })).toBeVisible()
})

// **두 '내역'은 같은 장부를 다르게 자른다.** 결제 예정만 보는 화면을 새로 만들지
// 않았다 — 무엇을 보고 있는지는 표 아래 범위 줄이 서버의 글로 말한다.
test('FIN-00: 두 내역이 같은 장부를 다른 단계로 자른다', async ({ page }) => {
  await page.goto(OVERVIEW)

  const 내역 = page.getByRole('button', { name: '내역' })
  await 내역.first().click()
  await expect(page).toHaveURL(/#\/FIN-LEDGER-01\?stage=spent/)
  await expect(page.locator('[data-node-id="30:3287"]')).toContainText('결제 완료')

  await page.goto(OVERVIEW)
  await 내역.nth(1).click()
  await expect(page).toHaveURL(/#\/FIN-LEDGER-01\?stage=planned/)
  await expect(page.locator('[data-node-id="30:3287"]')).toContainText('결제 예정')

  // 거르지 않으면 장부 전부를 본다.
  await page.goto('/#/FIN-LEDGER-01')
  await expect(page.locator('[data-node-id="30:3287"]')).toContainText('총 42건')
})

test('FIN-00: 사용 내역 전체 보기가 장부로 데려간다', async ({ page }) => {
  await page.goto(OVERVIEW)

  await page.getByRole('button', { name: '사용 내역 전체 보기' }).click()

  await expect(page).toHaveURL(/#\/FIN-LEDGER-01$/)
})

// 최근 지출 내역과 사용 내역은 **같은 장부**다. 겉면은 그중 몇 줄만 얹는다.
test('FIN-00: 최근 지출 내역과 증빙 현황을 함께 보여준다', async ({ page }) => {
  await page.goto(OVERVIEW)

  const recent = page.locator('[data-node-id="30:2697"]')
  await expect(recent).toContainText('현수막 제작')
  await expect(recent).toContainText('180,000원')
  // 증빙 상태의 말은 하나다 — 한 지출의 증빙은 한 가지 상태이고, 그림이 두 말로
  // 그린 것은 와이어프레임이 스스로 어긋난 자리다(deviations.ts).
  await expect(recent).toContainText('완료')

  const proof = page.locator('[data-node-id="30:2735"]')
  await expect(proof).toContainText('전체 지출 건수')
  await expect(proof).toContainText('26건')
})

// ── FIN-LEDGER-01 · 사용 내역 ───────────────────────────────────────────────

test('FIN-LEDGER-01: 장부와 그 범위를 서버가 준 문장으로 보여준다', async ({ page }) => {
  await page.goto(LEDGER)

  await expect(page.locator('[data-node-id="30:3140"]')).toContainText('3,842,000원')
  // 달의 이름도 서버가 준다 — '7월'은 고른 달이 정한다.
  await expect(page.locator('[data-node-id="30:3145"]')).toContainText('7월 지출')

  const table = page.getByRole('table', { name: '사용 내역' })
  await expect(table).toContainText('케이블 커버 6m 외 1건')
  await expect(table).toContainText('회계 장부 바인더')

  // 표 아래 줄. 몇 건 중 몇 건인지도, 증빙을 어디서 처리하는지도 서버의 문장이다.
  const scope = page.locator('[data-node-id="30:3287"]')
  await expect(scope).toContainText('총 42건 중 최근 10건 표시')
  await expect(scope).toContainText('증빙 처리와 정산은')

  await page.screenshot({ path: `${SHOTS}/fin-ledger-01.png`, fullPage: true })
})

// 거르는 값은 전부 조회 인자다 — 받아온 것을 화면에서 거르지 않는다.
test('FIN-LEDGER-01: 검색어로 거르면 그 줄만 남는다', async ({ page }) => {
  await page.goto(LEDGER)

  await page.getByRole('searchbox', { name: '내역·행사 검색' }).fill('현수막')

  const table = page.getByRole('table', { name: '사용 내역' })
  await expect(table).toContainText('현수막 제작 (본부석)')
  await expect(table.getByText('회계 장부 바인더')).toHaveCount(0)
})

test('FIN-LEDGER-01: 부서로 거른다', async ({ page }) => {
  await page.goto(LEDGER)

  await page.getByRole('combobox', { name: '부서' }).click()
  await page.getByRole('option', { name: '홍보부', exact: true }).click()

  const table = page.getByRole('table', { name: '사용 내역' })
  await expect(table).toContainText('SNS 광고 집행')
  await expect(table.getByText('회계 장부 바인더')).toHaveCount(0)
})

// 달을 바꾸면 표도 머리의 값도 함께 바뀐다 — 둘 다 같은 인자를 받기 때문이다.
test('FIN-LEDGER-01: 달을 바꾸면 머리의 값과 표가 함께 바뀐다', async ({ page }) => {
  await page.goto(LEDGER)

  await page.getByRole('combobox', { name: '조회할 달' }).click()
  await page.getByRole('option', { name: '2026년 6월', exact: true }).click()

  await expect(page.locator('[data-node-id="30:3145"]')).toContainText('6월 지출')
  await expect(page.locator('[data-node-id="30:3287"]')).toContainText('2026년 6월')
  await expect(page.getByRole('table', { name: '사용 내역' }).getByText('케이블 커버 6m 외 1건')).toHaveCount(0)
})

// 조건에 맞는 것이 없을 때 무엇이라 말할지는 화면이 짓지 않는다 — 카탈로그의
// messages.empty가 이미 갖고 있다.
test('FIN-LEDGER-01: 맞는 것이 없으면 카탈로그의 말로 답한다', async ({ page }) => {
  await page.goto(LEDGER)

  await page.getByRole('searchbox', { name: '내역·행사 검색' }).fill('있을 리 없는 지출')

  await expect(page.getByText('조건에 맞는 사용 내역이 없습니다')).toBeVisible()
})

test('FIN-00: 예산을 편성할 수 없는 사람에게 총예산 카드는 눌리지 않는다', async ({ page }) => {
  await page.goto(OVERVIEW)

  const card = page.locator('[data-node-id="30:2576"]')
  await expect(card).toBeVisible()
  await expect(card.getByText('총예산')).toBeVisible()
  // 눌리는 카드가 아니므로 '편성'이라는 말 자체가 없다.
  await expect(page.getByText('편성')).toHaveCount(0)
})

test('FIN-00B: 편성할 수 있는 사람에게는 그 카드가 눌러 들어가는 자리가 된다', async ({ page }) => {
  await page.goto(OVERVIEW_PLANNER)

  // 변형이 등록한 것은 이 카드 하나뿐이다. 나머지 셋은 노드 대 노드로 같다.
  const card = page.locator('[data-node-id="30:2863"]')
  await expect(card).toBeVisible()
  await expect(card.getByText('편성')).toBeVisible()
  await expect(card.getByText('총예산')).toBeVisible()

  await card.click()
  await expect(page.getByRole('status')).toContainText(
    pendingNoteAt('FIN-00B', '30:2863'),
  )
})
