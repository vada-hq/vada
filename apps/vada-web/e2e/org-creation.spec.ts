import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'

// ORG-01은 onboardingDraft 스코프를 note로 읽으므로, 실제 경로(ONB-01 입력 →
// ONB-02 → ORG-01)를 그대로 밟아야 소속 정보가 채워진 상태를 볼 수 있다.
test('ORG-01: 온보딩 값을 note로 읽고, 묶음·선택 버튼·보조 설명을 그린다', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('textbox', { name: '이름*' }).fill('김바다')
  await page.getByRole('textbox', { name: '학번*' }).fill('20221234')

  const school = page.getByRole('combobox', { name: '학교*' })
  await school.click()
  await school.fill('바다')
  await page.getByRole('option', { name: '바다대학교', exact: true }).click()

  const college = page.getByRole('combobox', { name: '단과대학*' })
  await college.click()
  await page.getByRole('option', { name: '해양과학대학', exact: true }).click()

  const department = page.getByRole('combobox', { name: '학부·학과*' })
  await department.click()
  await page.getByRole('option', { name: '해양환경학과', exact: true }).click()

  await page.getByRole('combobox', { name: '현재 학년*' }).click()
  await page.getByRole('option', { name: '1학년', exact: true }).click()

  await page.getByRole('button', { name: /다음: 시작 방식 선택/ }).click()
  await page.getByRole('button', { name: /새 학생회 만들기/ }).click()

  // 화면 카피는 스펙 meta에서 온다.
  await expect(page.getByRole('heading', { name: '학생회 기본 정보' })).toBeVisible()
  await expect(page.getByText('새 학생회 만들기').first()).toBeVisible()
  await expect(page.getByText('기본 정보 1 / 2')).toBeVisible()

  // group: 제목·설명과 멤버 필드
  const group = page.getByRole('region', { name: '대표 범위' })
  await expect(group.getByText('대표 학교와 단과대학을 선택해 주세요.')).toBeVisible()
  await expect(group.getByRole('combobox', { name: '학교*' })).toBeVisible()
  // enabledWhen 미충족: 비활성 문구가 disabledPlaceholder다.
  await expect(group.getByRole('combobox', { name: '단과대학*' })).toHaveAttribute(
    'placeholder',
    '학교를 먼저 선택하세요',
  )

  // presentation: choiceGroup
  await expect(page.getByRole('radio', { name: '총학생회' })).toBeVisible()
  await expect(page.getByRole('radio', { name: '기타' })).toBeVisible()

  // helperText
  await expect(page.getByText('학생회 기록과 구분을 위한 기준 연도입니다.')).toBeVisible()

  // note: 다른 스코프(onboardingDraft)의 라벨을 이어 표시한다.
  await expect(
    page.getByText('내 소속 정보 (참고): 바다대학교 · 해양과학대학 · 해양환경학과 · 1학년'),
  ).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/07-org01-initial.png`, fullPage: true })

  // 필수값이 비어 있으면 주 버튼은 차단되고 첫 누락으로 포커스가 간다.
  await page.getByRole('button', { name: /다음: 조직 구조 설정/ }).click()
  await expect(page.getByText('필수 항목입니다').first()).toBeVisible()
  await expect(page.getByRole('radio', { name: '총학생회' })).toBeFocused()
  await page.screenshot({ path: `${SHOTS}/08-org01-blocked.png`, fullPage: true })

  // 채워서 통과 — ORG-02는 미구현이므로 내비게이션 계약대로 명시적 오류.
  await page.getByRole('radio', { name: '단과대 학생회' }).click()
  const repSchool = group.getByRole('combobox', { name: '학교*' })
  await repSchool.click()
  await repSchool.fill('바다')
  await page.getByRole('option', { name: '바다대학교', exact: true }).click()
  const repCollege = group.getByRole('combobox', { name: '단과대학*' })
  await repCollege.click()
  await page.getByRole('option', { name: '해양과학대학', exact: true }).click()
  await page.getByRole('textbox', { name: '학생회명*' }).fill('제12대 해양과학대학 학생회')
  await page.getByRole('combobox', { name: '운영 연도*' }).click()
  await page.getByRole('option', { name: '2026년', exact: true }).click()
  await page.screenshot({ path: `${SHOTS}/09-org01-filled.png`, fullPage: true })

  await page.getByRole('button', { name: /다음: 조직 구조 설정/ }).click()
  await expect(page.getByText('구현에 등록되지 않은 화면입니다')).toBeVisible()
  await expect(page.getByText('ORG-02')).toBeVisible()
})
