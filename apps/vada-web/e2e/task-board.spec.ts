import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'

// TASK-01은 운영 허브의 '상시 업무' 카드로 도달한다.
async function goToBoard(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('textbox', { name: '이름*' }).fill('김바다')
  await page.getByRole('textbox', { name: '학번*' }).fill('20221234')

  const school = page.getByRole('combobox', { name: '학교*' })
  await school.click()
  await school.fill('바다')
  await page.getByRole('option', { name: '바다대학교', exact: true }).click()
  await page.getByRole('combobox', { name: '단과대학*' }).click()
  await page.getByRole('option', { name: '해양과학대학', exact: true }).click()
  await page.getByRole('combobox', { name: '학부·학과*' }).click()
  await page.getByRole('option', { name: '해양환경학과', exact: true }).click()
  await page.getByRole('combobox', { name: '현재 학년*' }).click()
  await page.getByRole('option', { name: '1학년', exact: true }).click()

  await page.getByRole('button', { name: /다음: 시작 방식 선택/ }).click()
  await page.getByRole('button', { name: /초대받은 학생회 참여하기/ }).click()
  // 초대 코드를 넣는 칸이 한 겹 더 있다(INV-00). 그 화면이 없던 동안 ONB-02가
  // INV-01로 바로 갔고, 이 길은 그때의 것이다.
  await page.getByRole('textbox', { name: '초대 코드' }).fill('AB12CD34')
  await page.getByRole('button', { name: '학생회 확인' }).click()
  await page.getByRole('button', { name: /소속 입력 후 학생회 참여하기/ }).click()
  await page.getByRole('button', { name: '운영', exact: true }).click()
  await page.getByRole('button', { name: /상시 업무/ }).click()
}

test('TASK-01: 열마다 고정된 단계로 따로 조회한다', async ({ page }) => {
  await goToBoard(page)

  await expect(page.getByText('구현에 등록되지 않은 화면입니다')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '상시 업무', level: 1 })).toBeVisible()

  // 열 넷은 명세가 정한다. 열의 건수는 명세에 없고 항목 수에서 나온다.
  for (const [title, count] of [
    ['예정', '2'],
    ['진행 중', '4'],
    ['검토 필요', '1'],
    ['완료', '2'],
  ]) {
    const column = page.getByRole('heading', { name: new RegExp(`^${title}`) })
    await expect(column).toContainText(count)
  }

  await page.screenshot({ path: `${SHOTS}/60-task01.png`, fullPage: true })
})

test('TASK-01: 보는 범위를 바꾸면 모든 열이 다시 조회된다', async ({ page }) => {
  await goToBoard(page)

  await expect(page.getByText('회계 장부 주간 정리')).toBeVisible()

  await page.getByRole('radio', { name: '내 업무' }).click()

  // 박해랑 담당은 진행 중 1건 · 검토 필요 1건뿐이다.
  await expect(page.getByText('회계 장부 주간 정리')).toHaveCount(0)
  await expect(page.getByText('주간 운영회의 자료 준비')).toBeVisible()
  await expect(page.getByRole('heading', { name: /^진행 중/ })).toContainText('1')
  await expect(page.getByRole('heading', { name: /^예정/ })).toContainText('0')

  await page.screenshot({ path: `${SHOTS}/61-task01-mine.png`, fullPage: true })
})

test('TASK-01: 카드를 누르면 아직 없는 화면임을 남긴다', async ({ page }) => {
  await goToBoard(page)

  await page.getByRole('button', { name: /회계 장부 주간 정리/ }).click()
  await expect(
    page.getByText('업무 상세 화면이 아직 명세되지 않았습니다.'),
  ).toBeVisible()
})
