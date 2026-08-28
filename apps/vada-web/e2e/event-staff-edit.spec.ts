import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { missingNoteOf, pendingNoteOf } from './spec'

const SHOTS = 'e2e/shots'

// spec.ts의 pendingNoteOf는 **이름으로** 요소를 찾는다. EVT-03B에는 같은 글을
// 가진 요소가 둘이다 — '부서 추가'가 칸의 라벨이면서 단추의 이름이다(디자인이
// 그렇게 그렸다). 그래서 그 자리만 등록 노드로 짚는다. 어느 쪽이든 글을 검사에
// 옮겨 적지 않는 것이 요점이다.
const SCREENS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../specs/figma/vada-wireframe/screens',
)

function pendingNoteAt(screenId: string, nodeId: string): string {
  const spec = JSON.parse(
    readFileSync(join(SCREENS_DIR, screenId, 'screen.json'), 'utf-8'),
  ) as { elements: Array<{ source: { nodeId: string }; spec?: { action?: { type?: string; note?: string } } }> }
  const action = spec.elements.find((element) => element.source.nodeId === nodeId)?.spec?.action
  if (action?.type !== 'pending' || action.note === undefined) {
    throw new Error(`${screenId}의 ${nodeId}는 pending이 아니거나 note가 없습니다.`)
  }
  return action.note
}

// 운영 조직을 **세우는** 화면과 **고치는** 화면. EVT-03A(보기)의 형제다.
//
// EVT-01은 셸이 없는 카드 한 장이고 EVT-03B는 행사 작업 공간 안이다. 둘 다
// 겹쳐 뜨는 화면이 아니다 — 이 와이어프레임의 모달은 예외 없이 아래 화면을
// 형제로 함께 그리고 30% 검은 막을 까는데, EVT-01의 바깥은 불투명한 gray-50
// 한 장이고 EVT-03B는 DesktopShell 자체다.
const SETUP = '/#/EVT-01?eventId=E-01'
// 조직을 아직 세우지 않은 행사. EVT-03A의 빈 상태에서 이리로 온다.
const SETUP_NEW = '/#/EVT-01?eventId=E-03'
const EDIT = '/#/EVT-03B?eventId=E-01'

// 갈피 줄은 셸의 메뉴와 이름이 겹친다. 작업 공간 안에서만 찾는다.
const tabs = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: /행사를 여는 화면들/ })

// ── EVT-01 · 행사 운영 조직 설정 ──────────────────────────────────────────

test('EVT-01: 인자가 없으면 아무 행사의 조직이나 세우지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-01')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-01', 'eventId'))
  await expect(page.getByRole('radiogroup')).toHaveCount(0)
})

test('EVT-01: 눈썹이 그 행사의 이름이고 방식 셋을 고를 수 있다', async ({ page }) => {
  await page.goto(SETUP)

  // **눈썹이 데이터다** — 명세는 고정 글이 아니라 출처의 조각을 가리킨다.
  await expect(page.getByText('2026 소프트웨어융합대학 체육대회')).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 1, name: '행사 운영 조직 설정' }),
  ).toBeVisible()

  for (const label of ['기본 조직 불러오기', '참여 부서만 선택', '빈 조직']) {
    await expect(page.getByRole('radio', { name: new RegExp(label) })).toBeVisible()
  }
  // 처음 골라져 있는 것은 명세가 말한다(initialValue: copyBase).
  await expect(
    page.getByRole('radio', { name: /기본 조직 불러오기/ }),
  ).toHaveAttribute('aria-checked', 'true')

  await page.screenshot({ path: `${SHOTS}/evt-01.png`, fullPage: true })
})

// 미리보기는 **고른 방식이 조회 인자로 들어간다**(event.staffSetupPreview의
// setupMode). 화면이 받아 온 것을 거르는 것이 아니라 다시 물어 온다.
test('EVT-01: 방식을 바꾸면 만들어질 조직이 바뀐다', async ({ page }) => {
  await page.goto(SETUP)

  for (const name of ['운영팀', '홍보팀', '현장팀']) {
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
  await expect(page.getByText('부원 2명')).toBeVisible()

  await page.getByRole('radio', { name: /빈 조직/ }).click()
  // 비었다는 말은 출처가 갖는다(messages.empty).
  await expect(page.getByText('만들어질 부서가 없습니다')).toBeVisible()
  await expect(page.getByText('운영팀', { exact: true })).toBeHidden()

  await page.getByRole('radio', { name: /참여 부서만 선택/ }).click()
  await expect(page.getByText('운영팀', { exact: true })).toBeVisible()
  await expect(page.getByText('부원 0명')).toHaveCount(3)
})

test('EVT-01: 부서장이 없는 부서에만 지정 버튼이 있다', async ({ page }) => {
  await page.goto(SETUP)

  const assign = page.getByRole('button', { name: /부서장 지정/ })
  await expect(assign).toHaveCount(1)

  await assign.click()
  await expect(page.getByRole('status')).toHaveText(pendingNoteOf('EVT-01', '부서장'))
})

test('EVT-01: 책임자를 고르지 않으면 저장이 막힌다', async ({ page }) => {
  await page.goto(SETUP_NEW)

  await page.getByRole('button', { name: '저장' }).click()

  // 막았으면 무엇 때문인지 말한다(onExecutionBlocked.showMissingRequiredFields).
  await expect(page.getByText('필수 항목입니다')).toBeVisible()
  await expect(page).toHaveURL(/#\/EVT-01/)
})

test('EVT-01: 책임자를 고르고 저장하면 그 행사의 운영 조직으로 간다', async ({ page }) => {
  await page.goto(SETUP_NEW)

  const leader = page.getByRole('combobox', { name: '행사 책임자*' })
  await leader.click()
  await page.getByRole('option', { name: /김바다/ }).click()

  await page.getByRole('button', { name: '저장' }).click()
  await expect(page).toHaveURL(/#\/EVT-03A\?eventId=E-03/)
})

test('EVT-01: 이전은 같은 행사를 데리고 운영 조직으로 돌아간다', async ({ page }) => {
  await page.goto(SETUP_NEW)

  await page.getByRole('button', { name: '이전' }).click()
  await expect(page).toHaveURL(/#\/EVT-03A\?eventId=E-03/)
})

// ── EVT-03B · 운영 조직 수정 ─────────────────────────────────────────────

test('EVT-03B: 인자가 없으면 아무 행사의 조직이나 고치지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-03B')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-03B', 'eventId'))
  await expect(page.getByText('기본 조직 구성원')).toHaveCount(0)
})

test('EVT-03B: 고칠 나무와 기본 조직 명단을 나란히 그린다', async ({ page }) => {
  await page.goto(EDIT)

  // 제목은 그 행사의 이름이다(작업 공간이 정한다).
  await expect(
    page.getByRole('heading', { level: 1, name: '2026 소프트웨어융합대학 체육대회' }),
  ).toBeVisible()

  // 같은 글이 둘이다 - 카드의 머리이자 그 안 고르는 칸의 라벨이다.
  // 디자인이 그렇게 그렸으므로 둘 다 있는 것이 옳다.
  await expect(page.getByText('행사 책임자', { exact: true })).toHaveCount(2)
  // 자리 이름은 데이터가 준다 — 명세도 화면도 '책임자'를 들고 있지 않다.
  await expect(page.getByText('책임자', { exact: true })).toBeVisible()

  for (const name of ['운영팀', '홍보팀', '현장팀']) {
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
  await expect(page.getByText('기본 조직 구성원')).toBeVisible()
  await expect(page.getByText('각 부서 카드의 “＋ 구성원 추가”로 배정')).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/evt-03b.png`, fullPage: true })
})

// itemMove: 자리를 잃은 사람이 어디에 모이는지는 명세가 말하고(poolSourceKey),
// **어떻게 옮기는지는 design이 정한다** — 여기서는 동그란 빼기 표시다.
test('EVT-03B: 부서에서 뺀 사람은 기본 조직 명단으로 돌아간다', async ({ page }) => {
  await page.goto(EDIT)

  const panel = page.getByRole('complementary', { name: '기본 조직 구성원' })
  const released = page.getByRole('button', { name: /부서에서 빼기/ })
  await expect(released).toHaveCount(4)

  // 글이 없는 조작이라 이름은 보조기기만 읽는다(itemMove.releaseLabel).
  await page.getByRole('button', { name: '박해랑 부서에서 빼기' }).click()

  await expect(released).toHaveCount(3)
  await expect(panel.getByText('박해랑')).toHaveCount(1)
})

test('EVT-03B: 구성원 추가로 고른 사람이 그 부서에 든다', async ({ page }) => {
  await page.goto(EDIT)

  await page.getByRole('button', { name: '박해랑 부서에서 빼기' }).click()
  await expect(page.getByRole('button', { name: '박해랑 부서에서 빼기' })).toHaveCount(0)

  // 홍보팀 카드의 마지막 칸이 사람을 보내는 자리다(오른쪽 기둥의 안내가 가리킨다).
  const add = page.getByRole('combobox', { name: '구성원 추가' }).nth(1)
  await add.click()
  await page.getByRole('option', { name: /박해랑/ }).click()

  await expect(page.getByRole('button', { name: '박해랑 부서에서 빼기' })).toHaveCount(1)
})

test('EVT-03B: 취소는 고치던 것을 버리고 보기 화면으로 돌아간다', async ({ page }) => {
  await page.goto(EDIT)

  await page.getByRole('button', { name: '박해랑 부서에서 빼기' }).click()
  await page.getByRole('button', { name: '취소' }).click()
  await expect(page).toHaveURL(/#\/EVT-03A\?eventId=E-01/)

  // 초안을 버렸으므로 다시 열면 뺀 것이 없던 일이 된다(action.scopeEvent: cancel).
  await page.goto(EDIT)
  await expect(page.getByRole('button', { name: '박해랑 부서에서 빼기' })).toHaveCount(1)
})

test('EVT-03B: 책임자를 고르지 않으면 완료가 막힌다', async ({ page }) => {
  await page.goto(EDIT)

  await page.getByRole('button', { name: '완료' }).click()
  await expect(page.getByText('필수 항목입니다')).toBeVisible()
  await expect(page).toHaveURL(/#\/EVT-03B/)
})

test('EVT-03B: 책임자를 고르고 완료하면 보기 화면으로 간다', async ({ page }) => {
  await page.goto(EDIT)

  const leader = page.getByRole('combobox', { name: '행사 책임자*' })
  await leader.click()
  await page.getByRole('option', { name: /이윤슬/ }).click()

  await page.getByRole('button', { name: '완료' }).click()
  await expect(page).toHaveURL(/#\/EVT-03A\?eventId=E-01/)
})

test('EVT-03B: 부서 이름을 적는 칸과 더하는 자리가 있다', async ({ page }) => {
  await page.goto(EDIT)

  await page.getByRole('textbox', { name: '부서 추가' }).fill('의전팀')
  await page.getByRole('button', { name: '부서 추가' }).click()

  await expect(page.getByRole('status')).toHaveText(pendingNoteAt('EVT-03B', '20:7135'))
})

test('EVT-03B: 갈피는 인원 관리이고 하위 갈피는 운영 조직이다', async ({ page }) => {
  await page.goto(EDIT)

  await expect(
    tabs(page).getByRole('button', { name: '인원 관리', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: '운영 조직', exact: true })).toBeDisabled()

  await page.getByRole('button', { name: '행사 참가자', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-04\?eventId=E-01/)
})
