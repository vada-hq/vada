import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'

// ORG-02는 흐름의 마지막 단계라 ORG-01을 거쳐 도달해야 스코프가 채워진다.
async function goToOrg02(page: import('@playwright/test').Page) {
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
  await page.getByRole('button', { name: /새 학생회 만들기/ }).click()

  await page.getByRole('radio', { name: '단과대 학생회' }).click()
  const group = page.getByRole('region', { name: '대표 범위' })
  const repSchool = group.getByRole('combobox', { name: '학교*' })
  await repSchool.click()
  await repSchool.fill('바다')
  await page.getByRole('option', { name: '바다대학교', exact: true }).click()
  await group.getByRole('combobox', { name: '단과대학*' }).click()
  await page.getByRole('option', { name: '해양과학대학', exact: true }).click()
  await page.getByRole('textbox', { name: '학생회명*' }).fill('제12대 해양과학대학 학생회')
  await page.getByRole('combobox', { name: '운영 연도*' }).click()
  await page.getByRole('option', { name: '2026년', exact: true }).click()
  await page.getByRole('button', { name: /다음: 조직 구조 설정/ }).click()
}

test('ORG-02: 기본 조직의 초기 부서와 조직도, 부서 추가·삭제', async ({ page }) => {
  await goToOrg02(page)

  await expect(page.getByRole('heading', { name: '조직 구조 설정' })).toBeVisible()
  await expect(page.getByText('조직 구조 설정 2 / 2')).toBeVisible()

  // 라디오 카드: 선택지마다 설명이 붙는다(options[].description).
  await expect(page.getByRole('radio', { name: /기본 조직/ })).toBeVisible()
  await expect(page.getByText('회장단만 생성하고 필요한 부서를 직접 추가합니다')).toBeVisible()

  // initialValue: basic → 기본 부서 3개가 미리 놓인다.
  await expect(page.getByText('회장단', { exact: true })).toBeVisible()
  for (const name of ['기획부', '홍보부', '디자인부']) {
    await expect(page.getByText(name)).toBeVisible()
  }
  await page.screenshot({ path: `${SHOTS}/10-org02-basic.png`, fullPage: true })

  // 부서 추가
  await page.getByRole('button', { name: /부서 추가/ }).click()
  await expect(page.getByRole('textbox', { name: '부서 이름' })).toBeVisible()
  await page.getByRole('textbox', { name: '부서 이름' }).fill('총무부')
  await page.getByRole('textbox', { name: '부서 이름' }).press('Enter')
  await expect(page.getByText('총무부')).toBeVisible()

  // 항목 메뉴로 삭제
  await page.getByRole('button', { name: '총무부 메뉴' }).click()
  await page.getByRole('button', { name: '삭제' }).click()
  await expect(page.getByText('총무부')).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}/11-org02-edited.png`, fullPage: true })
})

test('ORG-02: 빈 조직으로 바꾸면 부서가 초기화되고, 제출은 스코프를 비운다', async ({ page }) => {
  await goToOrg02(page)

  // resetOnChangeOf: 방식을 바꾸면 목록이 그 방식의 초기값으로 돌아간다.
  await page.getByRole('radio', { name: /빈 조직/ }).click()
  await expect(page.getByText('기획부')).toHaveCount(0)
  await expect(page.getByText('회장단', { exact: true })).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/12-org02-empty.png`, fullPage: true })

  // submit: mock 전송이 끝나면 onSuccess.navigate로 이동한다. 도착 화면이
  // 무엇인지는 단언하지 않는다 — 그 화면을 구현하는 순간 깨지기 때문이다
  // (방법론: 미구현을 단언하지 않는다). 여기서 볼 것은 "떠났는가"다.
  await page.getByRole('button', { name: /조직 만들기/ }).click()
  await expect(page.getByRole('heading', { name: '조직 구조 설정' })).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}/13-org02-submitted.png`, fullPage: true })
})
