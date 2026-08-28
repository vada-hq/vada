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
  // 초대 코드를 넣는 칸이 한 겹 더 있다(INV-00). 그 화면이 없던 동안 ONB-02가
  // INV-01로 바로 갔고, 이 길은 그때의 것이다.
  await page.getByRole('textbox', { name: '초대 코드' }).fill('AB12CD34')
  await page.getByRole('button', { name: '학생회 확인' }).click()
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

// **이 화면의 카드는 이제 전부 갈 곳이 있다.** 상시 업무·회의·행사에 이어
// 캘린더가 마지막이었다.
test('OPS-00: 캘린더 카드는 운영 캘린더로 데려간다', async ({ page }) => {
  await goToOperations(page)

  await page.getByText('캘린더', { exact: true }).click()
  await expect(page).toHaveURL(/#\/OPS-CAL-01/)
})

test('OPS-00: 상시 업무 카드는 칸반 보드로 이동한다', async ({ page }) => {
  await goToOperations(page)

  await page.getByText('상시 업무', { exact: true }).click()
  await expect(page.getByRole('heading', { name: '상시 업무', level: 1 })).toBeVisible()
})
