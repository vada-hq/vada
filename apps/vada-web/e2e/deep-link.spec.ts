import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'

// 흐름 중간 화면을 앞 단계 없이 여는 것이 이 기능의 완료 조건이다.
// 화면의 주소는 screenId다 — 명세가 이미 갖고 있어 따로 정하지 않는다.

test('주소로 흐름 중간 화면을 바로 연다', async ({ page }) => {
  await page.goto('/#/TASK-01')

  // 온보딩 4개 필드를 채우지 않고도 열린다.
  await expect(page.getByRole('heading', { name: '상시 업무', level: 1 })).toBeVisible()
  await expect(page.getByText('회계 장부 주간 정리')).toBeVisible()
})

test('화면을 옮기면 주소가 따라가고 뒤로 가기가 동작한다', async ({ page }) => {
  await page.goto('/#/OPS-00')
  await expect(page.getByText('운영 공간', { exact: true })).toBeVisible()

  await page.getByText('상시 업무', { exact: true }).click()
  await expect(page).toHaveURL(/#\/TASK-01$/)

  await page.goBack()
  await expect(page).toHaveURL(/#\/OPS-00$/)
  await expect(page.getByText('운영 공간', { exact: true })).toBeVisible()
})

test('개발용 화면 목록이 등록된 화면을 모두 보여준다', async ({ page }) => {
  await page.goto('/#/HOME-01K')

  await page.getByRole('button', { name: /화면 HOME-01K/ }).click()
  const panel = page.getByText('화면 목록', { exact: true }).locator('..').locator('..')

  for (const screenId of [
    'ONB-01',
    'ONB-02',
    'INV-01',
    'ORG-01',
    'ORG-02',
    'HOME-01K',
    'MY-01',
    'OPS-00',
    'TASK-01',
  ]) {
    await expect(panel.getByText(screenId, { exact: true })).toBeVisible()
  }

  await page.screenshot({ path: `${SHOTS}/70-screen-picker.png`, fullPage: true })

  await panel.getByText('MY-01', { exact: true }).click()
  await expect(page).toHaveURL(/#\/MY-01$/)
})
