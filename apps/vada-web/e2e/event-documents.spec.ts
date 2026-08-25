import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const DOCUMENTS = '/#/EVT-DOC-01?eventId=E-01'

// 갈피 줄은 셸의 메뉴와 이름이 겹친다(재정·업무). 작업 공간 안에서만 찾는다.
const tabs = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: /행사를 여는 화면들/ })

// EVT-DOC-01은 행사 작업 공간의 **세 번째** 화면이다. 앞의 둘이 같은 모양이라
// 자리가 맞았을 뿐일 수 있어, 세 번째가 그대로 들어가는지를 여기서 본다.

test('EVT-DOC-01: 행사 인자로 그 행사의 문서를 연다', async ({ page }) => {
  await page.goto(DOCUMENTS)

  await expect(
    page.getByRole('heading', { level: 1, name: '2026 소프트웨어융합대학 체육대회' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: '행사 문서' })).toBeVisible()
  await expect(page.getByText('행사 운영 계획서')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/evt-doc-01.png`, fullPage: true })
})

test('EVT-DOC-01: 인자가 없으면 아무 행사의 문서나 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-DOC-01')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-DOC-01', 'eventId'))
  await expect(page.getByText('행사 운영 계획서')).toBeHidden()
})

// 작업 공간이 세 번째로 쓰인다 — 머리는 세 화면이 나눠 쓰는 하나다.
test('EVT-DOC-01: 갈피를 옮겨 세 화면을 오가도 같은 행사다', async ({ page }) => {
  await page.goto(DOCUMENTS)
  await expect(page.getByText('담당 학술체육부 · 김바다')).toBeVisible()

  await tabs(page).getByRole('button', { name: '개요', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-02\?eventId=E-01/)

  await tabs(page).getByRole('button', { name: '업무', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-TASK-01\?eventId=E-01/)

  await tabs(page).getByRole('button', { name: '문서', exact: true }).click()
  await expect(page).toHaveURL(/#\/EVT-DOC-01\?eventId=E-01/)
  await expect(page.getByRole('heading', { name: '행사 문서' })).toBeVisible()
})

// 고를 것은 명세가, 몇 건인지는 데이터가 정한다.
test('EVT-DOC-01: 상태를 고르면 그 상태의 문서만 남는다', async ({ page }) => {
  await page.goto(DOCUMENTS)

  // 개수는 고른 상태와 무관하게 전체를 센다 — 고르는 순간 나머지가 0이 되면 안 된다.
  const filter = page.getByRole('radiogroup', { name: /문서를 상태로 거르는/ })
  await expect(filter.getByRole('radio', { name: /^전체\s*4$/ })).toBeVisible()
  await expect(filter.getByRole('radio', { name: /^검토 중\s*1$/ })).toBeVisible()

  await filter.getByRole('radio', { name: /^검토 중/ }).click()

  await expect(page.getByText('안전 관리 체크리스트')).toBeVisible()
  await expect(page.getByText('행사 운영 계획서')).toBeHidden()
  // 개수는 그대로다 — 거른 뒤에 세면 나머지 선택지가 전부 0이 된다.
  await expect(filter.getByRole('radio', { name: /^전체\s*4$/ })).toBeVisible()
})

// 열 머리는 명세가 갖는다(itemList.columns) — 화면은 design.json을 실행 중에 읽지 않는다.
test('EVT-DOC-01: 표는 열 머리를 갖는다', async ({ page }) => {
  await page.goto(DOCUMENTS)

  // '문서'는 갈피 줄에도 있다. 표 안에서만 찾는다.
  const table = page.locator('[data-node-id="28:578"]')
  for (const label of ['문서', '상태', '최근 갱신']) {
    await expect(table.getByText(label, { exact: true })).toBeVisible()
  }
})

test('EVT-DOC-01: 문서를 여는 화면이 없다는 사실을 남긴다', async ({ page }) => {
  await page.goto(DOCUMENTS)

  await page.getByRole('button', { name: /행사 운영 계획서 문서 열기/ }).click()
  await expect(page.getByText(/문서를 여는 화면이 아직 명세되지 않았습니다/)).toBeVisible()
})
