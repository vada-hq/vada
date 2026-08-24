import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'

// EVT-TASK-02는 지금까지와 다르다 — **무엇의 상세인지를 밖에서 받는다.**
// 그 값을 주소가 실어 오므로 화면 하나만 따로 여는 성질이 유지된다.
const TASK = '/#/EVT-TASK-02?taskId=T-03'

test('EVT-TASK-02: 화면 인자로 업무 한 건을 집어 온다', async ({ page }) => {
  await page.goto(TASK)

  await expect(page.getByRole('heading', { name: '현수막 디자인 수정 반영' })).toBeVisible()
  await expect(page.getByText('T-03')).toBeVisible()
  await expect(page.getByText('이윤슬')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/evt-task-02.png`, fullPage: true })
})

test('EVT-TASK-02: 인자가 없으면 아무 업무나 보여주지 않고 드러낸다', async ({ page }) => {
  await page.goto('/#/EVT-TASK-02')

  // 조용한 대체는 명세의 구멍을 숨긴다. 미등록 화면 오류 카드와 같은 태도다.
  await expect(page.getByRole('alert')).toContainText('taskId')
  await expect(page.getByRole('heading', { name: '현수막 디자인 수정 반영' })).toBeHidden()
})

test('EVT-TASK-02: 갈피를 바꾸면 아직 명세되지 않았음을 알린다', async ({ page }) => {
  await page.goto(TASK)

  await expect(page.getByText('공식 참고 문서')).toBeVisible()
  await page.getByRole('radio', { name: '처리 기록' }).click()

  await expect(page.getByText('공식 참고 문서')).toBeHidden()
  await expect(page.getByText(/아직 명세되지 않았습니다/)).toBeVisible()
})

test('EVT-TASK-02: 표는 이 업무의 작업 문서를 열로 보여준다', async ({ page }) => {
  await page.goto(TASK)

  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader', { name: '파일·문서명' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: '공식 문서 반영' })).toBeVisible()
  await expect(table.getByRole('row')).toHaveCount(3)
  await expect(table.getByText('현수막 시안 v2.png')).toBeVisible()
})

test('EVT-TASK-02: 머리의 두 버튼과 파일 추가는 아직 정해지지 않았음을 남긴다', async ({
  page,
}) => {
  await page.goto(TASK)

  await page.getByRole('button', { name: '상태 변경' }).click()
  await expect(page.getByText(/업무 상태를 바꾸는 방법이 아직 정해지지 않았습니다/)).toBeVisible()

  // 보드는 생겼다(EVT-TASK-01). 남은 것은 상세가 '어느 행사인지'를 어디서 얻느냐다.
  await page.getByRole('button', { name: '업무 보드로' }).click()
  await expect(page.getByText(/어느 행사의 보드인지가 필요한데/)).toBeVisible()

  await page.getByRole('button', { name: '파일 추가' }).click()
  await expect(page.getByText(/파일을 올리는 방법이 아직 정해지지 않았습니다/)).toBeVisible()
})
