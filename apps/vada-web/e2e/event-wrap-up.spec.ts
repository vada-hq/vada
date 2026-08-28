import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const WRAP_UP = '/#/EVT-02D?eventId=E-02'

// 후속 정리 중인 행사의 개요(EVT-02D).
//
// EVT-02(기획 중)와 **다른 화면이다.** 같은 '개요' 갈피에서 열리지만 겹치는 것이
// 둘뿐이고 그 둘조차 다르다 — 기본 정보가 일곱 칸에서 네 칸으로 줄고 `참석자`가
// 새로 온다. 회의가 상태로 화면을 가른 것과 같다.
//
// **한 행사가 두 상태일 수 없으므로** 이 화면이 여는 것은 E-01이 아니라 후속 정리
// 중인 행사다(회의가 상태마다 회의를 하나씩 둔 것과 같은 자리다).

test('EVT-02D: 후속 정리 중인 행사의 개요를 연다', async ({ page }) => {
  await page.goto(WRAP_UP)

  await expect(page.getByText('행사는 종료되었으며 후속 정리가 진행 중입니다.')).toBeVisible()
  await expect(
    page.getByText('남은 업무와 기록을 확인한 후 행사를 완료 처리할 수 있습니다.'),
  ).toBeVisible()
  await expect(page.getByText('미완료 업무')).toBeVisible()
  await expect(page.getByText('6건')).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/evt-02d.png`, fullPage: true })
})

test('EVT-02D: 인자가 없으면 아무 행사나 보여주지 않고 드러낸다', async ({ page }) => {
  await page.goto('/#/EVT-02D')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-02D', 'eventId'))
  await expect(page.getByText('행사는 종료되었으며 후속 정리가 진행 중입니다.')).toBeHidden()
})

// 상태 이름도, 누가 무엇을 할 수 있는지도 화면이 짓지 않는다. 단계가 하나 늘거나
// 권한이 바뀌면 명세가 아니라 서버가 답한다(event.wrapUpBanner).
test('EVT-02D: 단계와 권한 안내는 서버가 준 글이다', async ({ page }) => {
  await page.goto(WRAP_UP)

  await expect(page.getByText('후속 정리 중', { exact: true })).toBeVisible()
  await expect(page.getByText('행사 완료 처리는 회장단만 할 수 있습니다.')).toBeVisible()
})

// 기본 정보가 EVT-02와 다른 것이 이 화면이 변형이 아니라 화면인 근거다.
test('EVT-02D: 기본 정보는 네 칸이고 참석자가 새로 온다', async ({ page }) => {
  await page.goto(WRAP_UP)

  await expect(page.getByText('참석자', { exact: true })).toBeVisible()
  await expect(page.getByText('집계 전')).toBeVisible()
  // 기획 중에만 있는 칸은 오지 않는다 — 명세가 칸을 넷만 든다.
  await expect(page.getByText('참가비')).toHaveCount(0)
  await expect(page.getByText('모집 정원')).toHaveCount(0)
})

// 타일 넷은 각자 다른 곳으로 간다. 셋만 갈 곳이 있고 하나는 없다 — design이 그
// 타일에 단추를 그리지 않았다.
test('EVT-02D: 정리 현황 타일마다 가는 곳이 다르다', async ({ page }) => {
  await page.goto(WRAP_UP)

  await page.getByRole('button', { name: '문서 보기 →' }).click()
  await expect(page).toHaveURL(/#\/EVT-DOC-01\?eventId=E-02/)

  await page.goto(WRAP_UP)
  await page.getByRole('button', { name: '관련 회의 보기 →' }).click()
  await expect(page).toHaveURL(/#\/EVT-MEET-01\?eventId=E-02/)

  await page.goto(WRAP_UP)
  await page.getByRole('button', { name: '업무 보기 →' }).first().click()
  await expect(page).toHaveURL(/#\/EVT-TASK-01\?eventId=E-02/)
})

test('EVT-02D: 갈 곳이 없는 타일에는 문구가 오지 않는다', async ({ page }) => {
  await page.goto(WRAP_UP)

  await expect(page.getByText('확인 필요 참가자')).toBeVisible()
  await expect(page.getByRole('button', { name: /참가자/ })).toHaveCount(0)
})

// 남은 항목은 개수가 데이터에 달렸고 줄마다 그 원본으로 간다.
test('EVT-02D: 남은 항목 줄은 업무 보드로 이어진다', async ({ page }) => {
  await page.goto(WRAP_UP)

  // exact - 작업 공간 머리의 '다음 일정' 줄이 같은 업무 이름을 안고 있다.
  await expect(page.getByText('참가자 모집 공지 작성', { exact: true })).toBeVisible()
  await expect(page.getByText('홍보부 · 이윤슬 · 07. 18까지 · 지연')).toBeVisible()

  await page.getByRole('button', { name: '업무 보기 →' }).last().click()
  await expect(page).toHaveURL(/#\/EVT-TASK-01\?eventId=E-02/)
})

// 비었다는 말은 화면이 짓지 않는다 — 카탈로그의 messages.empty가 이미 갖고 있다.
test('EVT-02D: 변경 사항이 없으면 카탈로그의 말로 답한다', async ({ page }) => {
  await page.goto(WRAP_UP)

  await expect(page.getByText('기록된 변경 사항이 없습니다.')).toBeVisible()
})

// 갈피 줄은 이 화면도 행사 작업 공간의 '개요' 아래에 있다고 말한다. EVT-02D는
// 갈피 자체가 아니라 그 갈피가 상태에 따라 다르게 그려진 자리다.
test('EVT-02D: 갈피를 옮기면 같은 행사의 다른 화면으로 간다', async ({ page }) => {
  await page.goto(WRAP_UP)

  await page
    .getByRole('navigation', { name: /행사를 여는 화면들/ })
    .getByRole('button', { name: '업무', exact: true })
    .click()

  await expect(page).toHaveURL(/#\/EVT-TASK-01\?eventId=E-02/)
})

// EVT-00A2는 **변형이라 주소가 없다.** 누가 보느냐가 정하는 것이지 어디로 가느냐가
// 정하는 것이 아니므로, 사람이 EVT-00A와 그 사이를 오갈 수 없다. 그래서 검사는
// 본 화면에서 그 단추가 없다는 것으로 변형을 짚는다(OPS-MEET-01A와 같다).
test('EVT-00A: 만들 수 없는 사람에게는 새 행사 단추가 없다', async ({ page }) => {
  await page.goto('/#/EVT-00A')

  await expect(page.getByRole('button', { name: '완료된 행사 보기 →' })).toBeVisible()
  await expect(page.getByRole('button', { name: '새 행사 만들기' })).toHaveCount(0)
})
