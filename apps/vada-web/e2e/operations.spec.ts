import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'

// OPS-00은 셸 메뉴 '운영'으로 도달한다. 온보딩을 지나야 셸이 있는 화면에 닿는다.
async function goToOperations(page: import('@playwright/test').Page) {
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
  await page.getByRole('button', { name: /소속 입력 후 학생회 참여하기/ }).click()
  await page.getByRole('button', { name: '운영', exact: true }).click()
}

test('OPS-00: 공간 넷과 각 공간의 건수를 보여준다', async ({ page }) => {
  await goToOperations(page)

  await expect(page.getByText('구현에 등록되지 않은 화면입니다')).toHaveCount(0)
  await expect(page.getByText('운영 공간', { exact: true })).toBeVisible()

  // 안내 문장은 서버가 완성해서 준다(descriptionField).
  await expect(page.getByText(/박해랑님이 확인할/)).toBeVisible()

  // 공간 넷은 명세가 정하고 건수만 서버에서 온다.
  for (const title of ['상시 업무', '회의', '행사', '캘린더']) {
    await expect(page.getByText(title, { exact: true })).toBeVisible()
  }

  // 세는 말이 대상마다 다르다 — 업무는 '건', 행사는 '개'.
  // 같은 숫자가 여러 카드에 나오므로 첫 번째만 본다.
  await expect(page.getByText('4건', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('2개', { exact: true }).first()).toBeVisible()

  // 권한 안내는 meta.footerNote다.
  await expect(page.getByText(/각 하위 공간에서만 표시됩니다/)).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/50-ops00.png`, fullPage: true })
})

test('OPS-00: 아직 없는 화면으로 가는 카드는 사유를 남긴다', async ({ page }) => {
  await goToOperations(page)

  // 상시 업무는 TASK-01이 생기면서 진짜 이동이 됐다. 아직 pending인 카드를 본다.
  await page.getByText('행사', { exact: true }).click()
  await expect(
    page.getByText('행사 목록 화면이 아직 명세되지 않았습니다.'),
  ).toBeVisible()
})

test('OPS-00: 상시 업무 카드는 칸반 보드로 이동한다', async ({ page }) => {
  await goToOperations(page)

  await page.getByText('상시 업무', { exact: true }).click()
  await expect(page.getByRole('heading', { name: '상시 업무', level: 1 })).toBeVisible()
})
