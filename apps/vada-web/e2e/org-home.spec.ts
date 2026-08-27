import { expect, test } from '@playwright/test'
import { pendingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const HOME = '/#/ORG-00'

// 조직 관리 홈(ORG-00)은 **셸의 갈피를 처음으로 켜는 화면**이다. 지금까지 왼쪽
// 메뉴의 '조직 관리'는 눌러도 아직 명세되지 않았다고만 답했다.

test('ORG-00: 영역 셋과 저마다의 한 줄을 보여준다', async ({ page }) => {
  await page.goto(HOME)

  await expect(page.getByRole('heading', { name: '조직 관리 홈' })).toBeVisible()
  await expect(page.getByText('관리할 영역을 선택하세요.')).toBeVisible()

  // 곁들이는 줄은 서버가 완성해 보낸 문장 하나다. 화면이 숫자를 이어 붙이지 않는다.
  for (const [title, line] of [
    ['부서 & 구성원', '부서 5개 · 구성원 18명'],
    ['학생 명단', '학생 1,284명 · 최근 갱신 07.01'],
    ['역할 및 권한', '기본 역할 3종 · 확정된 권한 매트릭스'],
  ]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible()
    await expect(page.getByText(line)).toBeVisible()
  }

  await page.screenshot({ path: `${SHOTS}/80-org00.png`, fullPage: true })
})

test('ORG-00: 왼쪽 메뉴의 조직 관리가 이 화면으로 이어진다', async ({ page }) => {
  await page.goto('/#/OPS-00')

  await page.getByRole('button', { name: '조직 관리' }).click()

  await expect(page).toHaveURL(/#\/ORG-00/)
  await expect(page.getByRole('heading', { name: '조직 관리 홈' })).toBeVisible()
})

// 셋 다 아직 명세되지 않은 화면으로 간다. **어디로 가는지를 지어내지 않고**
// 무엇이 미정인지를 남긴다 — 눌렀을 때 아무 일도 안 일어나면 고장으로 보인다.
test('ORG-00: 카드를 누르면 아직 없는 화면임을 남긴다', async ({ page }) => {
  await page.goto(HOME)

  await page.getByRole('button', { name: /부서 & 구성원/ }).click()

  await expect(page.getByText(pendingNoteOf('ORG-00', '부서 & 구성원'))).toBeVisible()
  await expect(page).toHaveURL(/#\/ORG-00/)
})
