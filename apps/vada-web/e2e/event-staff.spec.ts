import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { missingNoteOf, pendingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const STAFF = '/#/EVT-03A?eventId=E-01'
// 운영 조직이 아직 없는 행사. EVT-03C가 그린 것이 이 상태다.
const EMPTY_STAFF = '/#/EVT-03A?eventId=E-03'

// 갈피 줄은 셸의 메뉴와 이름이 겹친다. 작업 공간 안에서만 찾는다.
const tabs = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: /행사를 여는 화면들/ })

// 명세가 든 글을 검사에 옮겨 적으면 두 벌이 된다. spec.ts의 pendingNoteOf는
// title·label로만 찾으므로 **이름 없는 목록의 emptyAction**은 짚지 못한다
// (운영 조직 전체가 비었을 때가 그 자리다). 그동안은 여기서 읽는다.
const SCREENS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../specs/figma/vada-wireframe/screens',
)

function emptyActionOf(screenId: string, label: string): { label: string; note: string } {
  const spec = JSON.parse(
    readFileSync(join(SCREENS_DIR, screenId, 'screen.json'), 'utf-8'),
  ) as { elements: Array<{ spec?: { emptyAction?: { label?: string; note?: string } } }> }
  const found = spec.elements
    .map((element) => element.spec?.emptyAction)
    .find((action) => action?.label === label)
  if (found?.label === undefined || found.note === undefined) {
    throw new Error(`${screenId}에 '${label}'라는 emptyAction이 없습니다.`)
  }
  return { label: found.label, note: found.note }
}

// 운영 조직 — 보기(EVT-03A)는 행사 작업 공간의 '인원 관리' 갈피 안에서 다시
// 한 겹 들어간 화면이다. ORG-03A(학생회의 조직도)와 모양이 같고 물건이 다르다 —
// 저기는 학생회가 늘 갖는 조직이고 여기는 이 행사에만 있는 조직이다.

test('EVT-03A: 행사 인자로 그 행사의 운영 조직을 본다', async ({ page }) => {
  await page.goto(STAFF)

  // 제목은 그 행사의 이름이다(작업 공간이 정한다).
  await expect(
    page.getByRole('heading', { level: 1, name: '2026 소프트웨어융합대학 체육대회' }),
  ).toBeVisible()

  await expect(page.getByText('행사 책임자', { exact: true })).toBeVisible()
  // 자리 이름은 데이터가 준다 — 명세도 화면도 '책임자'를 들고 있지 않다.
  await expect(page.getByText('책임자', { exact: true })).toBeVisible()

  for (const name of ['운영팀', '홍보팀', '현장팀']) {
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }

  await page.screenshot({ path: `${SHOTS}/evt-03a.png`, fullPage: true })
})

test('EVT-03A: 인자가 없으면 아무 행사의 조직이나 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-03A')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-03A', 'eventId'))
  await expect(page.getByText('행사 책임자', { exact: true })).toBeHidden()
})

// 부원 수는 디자인에 **글자 하나로** 그려져 있어 서버가 완성해 보낸다 —
// 화면이 '부원'과 숫자를 이어 붙이지 않는다(itemList.titleField).
test('EVT-03A: 부원 수는 서버가 완성한 한 줄로 온다', async ({ page }) => {
  await page.goto(STAFF)

  await expect(page.getByText('부원 2명')).toHaveCount(1)
  await expect(page.getByText('부원 1명')).toHaveCount(2)
})

test('EVT-03A: 부서장이 없는 부서에만 지정 버튼이 있다', async ({ page }) => {
  await page.goto(STAFF)

  // 운영팀·현장팀에는 부서장이 있고 홍보팀에는 없다.
  const assign = page.getByRole('button', { name: /부서장 지정/ })
  await expect(assign).toHaveCount(1)

  await assign.click()
  await expect(page.getByRole('status')).toHaveText(pendingNoteOf('EVT-03A', '부서장'))
})

// 하위 갈피 줄은 EVT-04와 나눠 그리는 한 줄이다. 고르는 값이 아니라 **옮겨 가는
// 것**이라, 누르면 같은 행사를 데리고 저쪽 화면에 도착해야 한다.
test('EVT-03A: 하위 갈피는 같은 행사를 데리고 저쪽 화면으로 간다', async ({ page }) => {
  await page.goto(STAFF)

  // 지금 보고 있는 갈피는 누를 것이 없다.
  await expect(page.getByRole('button', { name: '운영 조직', exact: true })).toBeDisabled()

  await page.getByRole('button', { name: '행사 참가자', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-04\?eventId=E-01/)
  await expect(page.getByText('담당 학술체육부 · 김바다')).toBeVisible()
})

test('EVT-03A: 작업 공간의 갈피에서는 인원 관리가 지금 자리다', async ({ page }) => {
  await page.goto(STAFF)

  await expect(
    tabs(page).getByRole('button', { name: '인원 관리', exact: true }),
  ).toHaveAttribute('aria-current', 'page')

  await tabs(page).getByRole('button', { name: '일정', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-SCHED-01\?eventId=E-01/)
})

// EVT-03C는 화면이 아니라 이 화면의 빈 상태다. 갈피·머리·상태 줄이 그대로이고
// Main Content 안쪽만 바뀐다 — 오갈 수 있는 두 화면이 아니라 데이터가 없을 뿐이다.
test('EVT-03A: 운영 조직이 없는 행사는 같은 화면의 빈 상태로 그린다', async ({ page }) => {
  await page.goto(EMPTY_STAFF)

  // 갈피도 상태 줄도 그대로다 — 다른 화면이 아니라는 증거다.
  await expect(page.getByRole('button', { name: '운영 조직', exact: true })).toBeDisabled()
  await expect(
    tabs(page).getByRole('button', { name: '인원 관리', exact: true }),
  ).toHaveAttribute('aria-current', 'page')

  // 비었다는 말은 출처가 갖는다(event.staffDepartments의 messages.empty).
  await expect(page.getByText('아직 운영 조직이 구성되지 않았습니다')).toBeVisible()
  await expect(page.getByText('행사 책임자', { exact: true })).toBeHidden()

  await page.screenshot({ path: `${SHOTS}/evt-03a-empty.png`, fullPage: true })
})

test('EVT-03A: 빈 상태의 단추는 아직 없는 화면임을 남긴다', async ({ page }) => {
  await page.goto(EMPTY_STAFF)

  const emptyAction = emptyActionOf('EVT-03A', '운영 조직 구성하기')
  await page.getByRole('button', { name: emptyAction.label }).click()

  await expect(page.getByRole('status')).toHaveText(emptyAction.note)
})
