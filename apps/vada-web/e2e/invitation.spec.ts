import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'

// INV-01은 ONB-02 → INV-00 → INV-01로 도달한다. **초대 코드를 넣는 칸이 한 겹 더
// 있다** — INV-00이 없던 동안 ONB-02가 INV-01로 바로 갔다. ONB-01의 필수값을
// 채우지 않으면 executeWhen이 이동을 막으므로 온보딩을 먼저 통과해야 한다.
async function goToInv01(page: import('@playwright/test').Page) {
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
  await page.getByRole('textbox', { name: '초대 코드' }).fill('AB12CD34')
  await page.getByRole('button', { name: '학생회 확인' }).click()
}

// INV-01은 flows.json의 어느 흐름에도 속하지 않는다 — 진행 표시가 없는 첫 화면이다.
test('INV-01: 초대 요약을 보여주고, 소속을 채워야 참여할 수 있다', async ({ page }) => {
  await goToInv01(page)

  // summary: 눈썹·제목·라벨-값 3쌍
  await expect(page.getByText('초대받은 학생회', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '제12대 소프트웨어융합대학 학생회' }),
  ).toBeVisible()
  await expect(page.getByText('단과대 학생회')).toBeVisible()
  await expect(page.getByText('한양대학교 ERICA · 소프트웨어융합대학')).toBeVisible()
  await expect(page.getByText('2026년')).toBeVisible()

  // group: 제목·설명과 멤버 필드
  await expect(page.getByText('본인 소속 입력')).toBeVisible()
  await expect(page.getByText('초대 링크로 처음 참여하는 경우에만 입력합니다.')).toBeVisible()

  // 이 화면은 흐름에 속하지 않으므로 진행 표시가 없다.
  await expect(page.getByText(/\d \/ \d/)).toHaveCount(0)

  await page.screenshot({ path: `${SHOTS}/20-inv01.png`, fullPage: true })

  // onboardingDraft 재사용: ONB-01에서 채운 값이 그대로 들어 있다.
  await expect(page.getByRole('combobox', { name: '학교*' })).toHaveValue('바다대학교')
  await expect(page.getByRole('textbox', { name: '학번*' })).toHaveValue('20221234')
})

test('INV-01: 필수값이 비면 참여가 막히고 누락 필드를 표시한다', async ({ page }) => {
  await goToInv01(page)

  // 학번을 비우면 executeWhen이 막는다.
  await page.getByRole('textbox', { name: '학번*' }).fill('')
  await page.getByRole('button', { name: /소속 입력 후 학생회 참여하기/ }).click()

  await expect(page.getByText('필수 항목입니다')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '제12대 소프트웨어융합대학 학생회' }),
  ).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/21-inv01-blocked.png`, fullPage: true })
})
