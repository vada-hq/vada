import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'

// MY-01은 HOME-01K의 '내 담당 업무'로 도달한다. 그 전에 온보딩 필수값을 채워야
// 이동이 막히지 않는다(home.spec.ts와 같은 경로다).
async function goToMyTasks(page: import('@playwright/test').Page) {
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
  await page.getByRole('button', { name: /내 담당 업무/ }).click()
}

test('MY-01: 탭과 검색어가 목록의 조회 인자다', async ({ page }) => {
  await goToMyTasks(page)

  await expect(page.getByText('구현에 등록되지 않은 화면입니다')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '내 업무' })).toBeVisible()

  // summary: 항목이 명세에 고정이고 값은 서버에서 온다.
  // design이 이름과 건수를 한 덩어리로 그리므로 화면도 한 덩어리다.
  await expect(page.getByText(/^지연 \d+건$/)).toBeVisible()

  // 탭 배지는 목록에서 센 값이라 목록과 어긋날 수 없다.
  const todo = page.getByRole('tab', { name: /해야 할 업무/ })
  await expect(todo).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('행사 안전 안내문 검토', { exact: true })).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/40-my01.png`, fullPage: true })

  // 탭을 바꾸면 서버에 다시 묻는다.
  await page.getByRole('tab', { name: /진행 중인 업무/ }).click()
  await expect(page.getByText('행사 안전 안내문 검토', { exact: true })).toHaveCount(0)
  await expect(page.getByText('참가자 모집 공지 작성')).toBeVisible()

  // 검색어도 인자다.
  await page.getByRole('searchbox', { name: '업무 검색' }).fill('운영회의')
  await expect(page.getByText('주간 운영회의 자료 준비')).toBeVisible()
  await expect(page.getByText('참가자 모집 공지 작성')).toHaveCount(0)

  await page.screenshot({ path: `${SHOTS}/41-my01-filtered.png`, fullPage: true })
})

test('MY-01: 항목을 누르면 아직 없는 화면임을 남긴다', async ({ page }) => {
  await goToMyTasks(page)

  await page.getByRole('button', { name: /행사 안전 안내문 검토/ }).click()
  await expect(
    page.getByText('업무 상세 화면이 아직 명세되지 않았습니다.'),
  ).toBeVisible()
})

test('MY-01: 셸의 메뉴로 홈에 돌아간다', async ({ page }) => {
  await goToMyTasks(page)

  await page.getByRole('button', { name: '홈', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '박해랑님, 확인이 필요해요' }),
  ).toBeVisible()
})
