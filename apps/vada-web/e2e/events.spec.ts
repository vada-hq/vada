import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'

// EVT-00A는 운영 허브의 '행사' 카드로 도달한다. 이번에 이어진 길이라 주소로 바로
// 열지 않고 눌러서 간다(OPS-00 16:674의 pending 해소).
async function goToEvents(page: import('@playwright/test').Page) {
  await page.goto('/#/OPS-00')
  await page.getByRole('button', { name: /행사 목록 보기/ }).click()
}

test('EVT-00A: 운영 허브의 행사 카드에서 도달한다', async ({ page }) => {
  await goToEvents(page)

  await expect(page.getByRole('heading', { name: '행사', level: 1 })).toBeVisible()
  await expect(page.getByText('2026 소프트웨어융합대학 체육대회')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/evt-00a.png`, fullPage: true })
})

test('EVT-00A: 머리 오른쪽의 화면 동작이 그려진다', async ({ page }) => {
  await goToEvents(page)

  // 셸이 아니라 이 화면의 요소다. 이 자리가 없던 동안 TASK-01의 '업무 추가'는
  // 명세에도 화면에도 없었다.
  const completed = page.getByRole('button', { name: '완료된 행사 보기 →' })
  await expect(completed).toBeVisible()

  // 완료된 행사 목록이 생겼다. 이 단추가 그 물음에 답한다 — 별도 화면인지조차
  // 정해지지 않았다고 적혀 있던 자리다.
  await completed.click()
  await expect(page).toHaveURL(/#\/REC-01/)
})

test('EVT-00A: 진행 단계 버튼이 목록을 거른다', async ({ page }) => {
  await goToEvents(page)

  await expect(page.getByText('봄 축제 학생회 부스')).toBeVisible()

  await page.getByRole('radio', { name: '기획 중' }).click()
  await expect(page.getByText('봄 축제 학생회 부스')).toBeHidden()
  await expect(page.getByText('2026 신입생 환영 행사')).toBeVisible()

  await page.getByRole('radio', { name: '후속 정리 중' }).click()
  await expect(page.getByText('봄 축제 학생회 부스')).toBeVisible()
  await expect(page.getByText('2026 신입생 환영 행사')).toBeHidden()
})

test('EVT-00A: 검색과 진행 단계가 함께 걸린다', async ({ page }) => {
  await goToEvents(page)

  await page.getByRole('searchbox', { name: '행사명 검색' }).fill('신입생')
  await expect(page.getByText('2026 신입생 환영 행사')).toBeVisible()
  await expect(page.getByText('2026 소프트웨어융합대학 체육대회')).toBeHidden()

  // 단계가 어긋나면 검색어가 맞아도 남지 않는다.
  await page.getByRole('radio', { name: '후속 정리 중' }).click()
  await expect(page.getByText('2026 신입생 환영 행사')).toBeHidden()
})

test('EVT-00A: 카드의 딱지는 행사마다 개수가 다르다', async ({ page }) => {
  await goToEvents(page)

  // 기획 중인 두 행사가 서로 다른 개수의 딱지를 갖는다 — 명세에 없는 자리 수다.
  await expect(page.getByText('신청자 142/200명')).toBeVisible()
  await expect(page.getByText('명단 확인 필요 6명')).toBeVisible()
  await expect(page.getByText('기본 정보 입력 필요')).toBeVisible()
  // 아직 닫히지 않은 것이 있는 행사에만 주의 줄이 붙는다.
  await expect(page.getByText('미완료 업무 3건 · 미정리 문서 2건')).toBeVisible()
})

test('TASK-01: 머리의 업무 추가 버튼이 그려진다', async ({ page }) => {
  await page.goto('/#/TASK-01')

  // design(18:86)에 있는데 명세에도 화면에도 없던 자리다. 머리 자리가 생겨 메웠다.
  const add = page.getByRole('button', { name: '업무 추가' })
  await expect(add).toBeVisible()

  await add.click()
  await expect(page.getByText(/업무 추가 화면이 아직 명세되지 않았습니다/)).toBeVisible()
})

// 새 행사를 만들 수 있는 사람이 보면 머리에 단추가 하나 더 온다(변형 EVT-00A2).
// **다른 화면이 아니다** — 명세가 조건을 든다(event.listViewer의 canCreateEvent).
test('EVT-00A: 만들 수 없는 사람에게는 새 행사 단추가 없다', async ({ page }) => {
  await page.goto('/#/EVT-00A')

  await expect(page.getByRole('button', { name: '새 행사 만들기' })).toHaveCount(0)
})

test('EVT-00A2: 만들 수 있는 사람에게는 그 단추가 온다', async ({ page }) => {
  await page.goto('/#/EVT-00A2')

  const create = page.getByRole('button', { name: '새 행사 만들기' })
  await expect(create).toBeVisible()

  // 명세가 이름까지 적어 두고도(EVT-00B) '아직 명세되지 않았다'로 남아 있던
  // 자리다. 그 모달은 그 뒤에 만들어졌고, 아무도 돌아와 잇지 않았다.
  await create.click()
  await expect(page).toHaveURL(/#\/EVT-00B/)
  await expect(page.getByRole('dialog', { name: '새 행사 만들기' })).toBeVisible()
})
