import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'

// HOME-01K는 INV-01의 '소속 입력 후 학생회 참여하기'로 도달한다. 그 전에
// ONB-01의 필수값을 채워야 executeWhen이 이동을 막지 않는다.
async function goToHome(page: import('@playwright/test').Page) {
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
}

test('HOME-01K: 데이터 출처가 선언한 값을 섹션마다 읽어 보여준다', async ({ page }) => {
  await goToHome(page)

  // 이동 대상이 구현에 등록됐다 — 이전에는 미등록 화면 안내가 떴다.
  await expect(page.getByText('구현에 등록되지 않은 화면입니다')).toHaveCount(0)

  // summary(titleField): 제목이 서버에서 온다.
  await expect(page.getByText('끼룩이가 알려드려요')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '박해랑님, 확인이 필요해요' }),
  ).toBeVisible()

  // itemList: 항목 수가 데이터에 달렸다.
  await expect(page.getByText('지연된 업무가 1건 있습니다.')).toBeVisible()
  await expect(page.getByText('담당자가 없는 업무가 2건 있습니다.')).toBeVisible()

  // summary(items[].field): 항목은 명세가 정하고 값은 출처에서 온다.
  await expect(page.getByText('진행 중 행사')).toBeVisible()
  await expect(page.getByText('이번 주 주요 일정')).toBeVisible()

  // 섹션 제목은 명세의 title이다.
  for (const title of [
    '진행 중·예정 행사',
    '다가오는 주요 일정',
    '조직 주요 알림',
    '전체 재정 요약',
  ]) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  }

  await expect(page.getByText('2026 소프트웨어융합대학 체육대회')).toBeVisible()
  await expect(page.getByText('체육대회 참가 신청 마감')).toBeVisible()
  await expect(page.getByText('증빙 서류 누락')).toBeVisible()

  // progressPercent는 숫자 조각이고 구현이 막대로 옮긴다.
  await expect(page.getByRole('progressbar', { name: /준비 62% · 지연 업무 1건/ })).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/30-home01k.png`, fullPage: true })
})

test('HOME-01K: 대상이 미정인 링크는 무엇이 미정인지 남긴다', async ({ page }) => {
  await goToHome(page)

  const pending = [
    ['지연 업무 보기', '지연된 업무 목록 화면이 아직 명세되지 않았습니다.'],
    ['캘린더 보기', '캘린더 화면이 아직 명세되지 않았습니다.'],
    ['전체 재정 보기', '재정 화면이 아직 명세되지 않았습니다.'],
    ['내 담당 업무', '내 업무 화면이 아직 명세되지 않았습니다.'],
  ]

  for (const [label, note] of pending) {
    const button = page.getByRole('button', { name: new RegExp(label) })
    await expect(button).toHaveAttribute('title', note)
  }

  // 눌러도 화면이 바뀌지 않는다 — 이동 대상이 없기 때문이다.
  await page.getByRole('button', { name: /캘린더 보기/ }).click()
  await expect(page.getByRole('heading', { name: '다가오는 주요 일정' })).toBeVisible()
})
