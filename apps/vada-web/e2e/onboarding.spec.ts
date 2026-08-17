import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'

test('온보딩 왕복: 입력→이동→미등록 화면 오류→복귀 시 값 유지', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: '내 프로필에 표시될 학적 정보를 입력해 주세요' }),
  ).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/01-onb01-initial.png`, fullPage: true })

  await page.getByRole('textbox', { name: '이름*' }).fill('김바다')
  await page.getByRole('textbox', { name: '학번*' }).fill('20221234')

  const school = page.getByRole('combobox', { name: '학교*' })
  await school.click()
  await school.fill('바다')
  await page.getByRole('option', { name: '바다대학교', exact: true }).click()

  const college = page.getByRole('combobox', { name: '단과대학*' })
  await expect(college).toHaveAttribute('placeholder', '단과대학을 선택하세요')
  await college.click()
  await page.getByRole('option', { name: '해양과학대학', exact: true }).click()

  const department = page.getByRole('combobox', { name: '학부·학과*' })
  await department.click()
  await page.getByRole('option', { name: '해양환경학과', exact: true }).click()

  await page.getByRole('combobox', { name: '현재 학년*' }).click()
  await page.getByRole('option', { name: '1학년', exact: true }).click()
  await page.screenshot({ path: `${SHOTS}/02-onb01-filled.png`, fullPage: true })

  await page.getByRole('button', { name: /다음: 시작 방식 선택/ }).click()
  await expect(page.getByRole('heading', { name: '어떻게 시작하시겠어요?' })).toBeVisible()
  await expect(page.getByText('시작 방식 선택 2 / 2')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/03-onb02.png`, fullPage: true })

  // 미등록 화면 이동은 내비게이션 계약대로 명시적 오류여야 한다.
  await page.getByRole('button', { name: /초대받은 학생회 참여하기/ }).click()
  await expect(page.getByText('구현에 등록되지 않은 화면입니다')).toBeVisible()
  await expect(page.getByText('INV-00')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/04-unregistered-inv00.png`, fullPage: true })

  // onboardingDraft 스코프: 복귀해도 입력값이 유지된다.
  await page.getByRole('button', { name: '처음 화면으로 돌아가기' }).click()
  await expect(page.getByRole('textbox', { name: '이름*' })).toHaveValue('김바다')
  await expect(page.getByRole('combobox', { name: '학교*' })).toHaveValue('바다대학교')
  await expect(page.getByRole('combobox', { name: '학부·학과*' })).toHaveValue('해양환경학과')
  await page.screenshot({ path: `${SHOTS}/05-back-retained.png`, fullPage: true })
})

test('빈 제출은 누락 필드 인라인 오류와 첫 누락 포커스로 차단된다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /다음: 시작 방식 선택/ }).click()

  await expect(page.getByText('필수 항목입니다').first()).toBeVisible()
  await expect(page.getByRole('textbox', { name: '이름*' })).toBeFocused()
  await page.screenshot({ path: `${SHOTS}/06-blocked-missing.png`, fullPage: true })
})
