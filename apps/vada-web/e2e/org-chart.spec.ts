import { expect, test } from '@playwright/test'
import { pendingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const CHART = '/#/ORG-03A'

// 조직 관리 — 보기(ORG-03A)는 **나무를 그리는 첫 화면**이다. 회장단 하나와 부서
// 여럿이 있다는 것만 명세가 말하고, 그 둘을 선으로 잇는 것은 design이 정한다.

test('ORG-03A: 회장단과 부서를 각자의 사람과 함께 보여준다', async ({ page }) => {
  await page.goto(CHART)

  // 제목은 데이터에서 온다 — 몇 대 학생회인지를 화면이 지어낼 수 없다.
  await expect(
    page.getByRole('heading', { name: '제12대 소프트웨어융합대학 학생회' }),
  ).toBeVisible()

  await expect(page.getByText('회장단', { exact: true })).toBeVisible()
  await expect(page.getByText('회장', { exact: true })).toBeVisible()
  await expect(page.getByText('부회장', { exact: true })).toBeVisible()

  for (const name of ['기획부', '홍보부', '디자인부']) {
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }

  await page.screenshot({ path: `${SHOTS}/81-org03a.png`, fullPage: true })
})

// 이 화면의 새 어휘 하나. '부원 2명'은 디자인에 **글자 하나로** 그려져 있어
// 서버가 완성해 보낸다 — 화면이 '부원'과 숫자를 이어 붙이지 않는다.
test('ORG-03A: 부원 수는 서버가 완성한 한 줄로 온다', async ({ page }) => {
  await page.goto(CHART)

  // 부서가 다섯이다 — 조직 요약이 '부서 5개'라고 말하는 것이 사실이고, 조직도가
  // 그린 셋은 덜 그린 것이다(docs/decisions/product-decisions.md).
  await expect(page.getByText('부원 2명')).toHaveCount(2)
  await expect(page.getByText('부원 1명')).toHaveCount(3)
})

// 새 어휘 둘. 부서장이 **없는 부서에만** 지정 버튼이 그려진다 — 있고 없고가
// 표현이 아니라 뜻이라 명세(emptyAction)가 갖는다.
test('ORG-03A: 부서장이 없는 부서에만 지정 버튼이 있다', async ({ page }) => {
  await page.goto(CHART)

  // 기획부에만 부서장이 있고 나머지 넷에는 없다.
  const assign = page.getByRole('button', { name: /부서장 지정/ })
  await expect(assign).toHaveCount(4)

  await assign.first().click()
  await expect(page.getByText(pendingNoteOf('ORG-03A', '부서장'))).toBeVisible()
})

test('ORG-03A: 구성원 추가는 아직 없는 화면임을 남긴다', async ({ page }) => {
  await page.goto(CHART)

  await page.getByRole('button', { name: '구성원 추가' }).click()

  await expect(page.getByText(pendingNoteOf('ORG-03A', '구성원 추가'))).toBeVisible()
})
