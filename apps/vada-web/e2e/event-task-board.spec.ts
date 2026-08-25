import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'

// EVT-TASK-01은 인자를 **받고 또 넘긴다**. EVT-TASK-02는 받기만 했다.
const BOARD = '/#/EVT-TASK-01?eventId=E-01'

test('EVT-TASK-01: 행사 인자로 그 행사의 보드를 연다', async ({ page }) => {
  await page.goto(BOARD)

  // 화면의 제목이 곧 그 행사의 이름이다(meta.titleFrom).
  await expect(
    page.getByRole('heading', { level: 1, name: '2026 소프트웨어융합대학 체육대회' }),
  ).toBeVisible()
  await expect(page.getByText('D-33')).toBeVisible()
  await expect(page.getByText('1 / 7 완료')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/evt-task-01.png`, fullPage: true })
})

test('EVT-TASK-01: 인자가 없으면 아무 행사나 보여주지 않고 드러낸다', async ({ page }) => {
  await page.goto('/#/EVT-TASK-01')

  await expect(page.getByRole('alert')).toContainText('eventId')
  await expect(page.getByText('D-33')).toBeHidden()
})

test('EVT-TASK-01: 열 넷이 단계별로 나뉘고 건수는 항목 수에서 나온다', async ({ page }) => {
  await page.goto(BOARD)

  // 건수는 명세에 없다 — 그 열의 항목 수가 곧 건수다. 열 머리 한 줄로 읽힌다.
  await expect(page.getByRole('heading', { name: '예정 2' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '진행 중 3' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '검토 필요 1' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '완료 1' })).toBeVisible()

  await expect(page.getByText('행사장 안전 점검')).toBeVisible()
})

// 이번 사이클의 핵심이다. 지금까지 상세 화면은 주소로만 들어갔다.
test('EVT-TASK-01: 카드를 누르면 그 카드가 어느 업무인지를 상세에 넘긴다', async ({ page }) => {
  await page.goto(BOARD)

  await page.getByRole('button', { name: /현수막 디자인 수정 반영/ }).click()

  // 주소가 값을 나른다 — 화면 하나만 따로 여는 성질이 유지된다.
  await expect(page).toHaveURL(/#\/EVT-TASK-02\?taskId=T-03/)
  await expect(page.getByRole('heading', { name: '현수막 디자인 수정 반영' })).toBeVisible()
  await expect(page.getByText('T-03')).toBeVisible()
})

test('EVT-TASK-01: 다른 카드는 다른 업무를 넘긴다', async ({ page }) => {
  await page.goto(BOARD)

  await page.getByRole('button', { name: /참가자 모집 공지 작성/ }).click()

  await expect(page).toHaveURL(/#\/EVT-TASK-02\?taskId=T-01/)
  // 보드에는 일곱인데 와이어프레임이 상세로 그린 것은 T-03 하나뿐이다. 없는 것을
  // 지어내지 않고, 카탈로그가 이미 갖고 있는 말로 답한다.
  await expect(page.getByRole('alert')).toContainText('업무를 찾지 못했습니다')
})

test('EVT-TASK-01: 내 업무만 보면 내가 담당인 것만 남는다', async ({ page }) => {
  await page.goto(BOARD)

  await expect(page.getByText('현수막 디자인 수정 반영')).toBeVisible()
  await page.getByRole('radio', { name: '내 업무' }).click()

  // 박해랑이 담당인 둘만 남는다. 거르는 것은 서버이지 화면이 아니다.
  await expect(page.getByText('물품 구매 요청')).toBeVisible()
  await expect(page.getByText('행사 안전 안내문 검토')).toBeVisible()
  await expect(page.getByText('현수막 디자인 수정 반영')).toBeHidden()
})

test('EVT-TASK-02: 업무 보드로 돌아가는 길이 아직 정해지지 않았음을 남긴다', async ({
  page,
}) => {
  await page.goto('/#/EVT-TASK-02?taskId=T-03')

  // 보드는 생겼지만 상세가 '어느 행사인지'를 어디서 얻는지는 정해지지 않았다.
  await page.getByRole('button', { name: '업무 보드로' }).click()
  await expect(page.getByText(/어느 행사의 보드인지가 필요한데/)).toBeVisible()
})

// 명세의 구멍을 드러내려고 던진 예외가 백지가 되면 가장 안 보이는 모양이 된다.
test('렌더 중 예외는 백지가 아니라 내용으로 드러난다', async ({ page }) => {
  // 없는 행사를 물으면 제목부터 던진다 — 그 자리는 '없을 수 있는 자리'로
  // 선언돼 있지 않다(업무 상세와 다르다). 백지가 아니라 메시지가 나와야 한다.
  await page.goto('/#/EVT-TASK-01?eventId=없는행사')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('화면을 그리지 못했습니다')
  await expect(alert).toContainText('EVT-TASK-01')
  await expect(alert).toContainText('event.summary')
})
