import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SCREEN = '/#/MY-REQ-01?eventId=E-01'

test('MY-REQ-01: 이 행사에서 내가 낸 요청만 모아 보여준다', async ({ page }) => {
  await page.goto(SCREEN)

  await expect(page.getByText('이 행사에서 내가 제출한 구매 요청 · 박해랑 · 운영부 · 부원')).toBeVisible()
  await expect(page.getByRole('table')).toContainText('REQ-001')
  await expect(page.getByRole('table')).toContainText('체육대회 운영 물품 4종')
})

test('MY-REQ-01: 상태별 개수는 목록에서 세지 않고 서버가 준다', async ({ page }) => {
  await page.goto(SCREEN)

  // 목록에는 요청이 하나뿐인데 다섯 칸이 다 그려진다. 화면이 셌다면 나머지 넷은
  // 그려질 자리조차 없었을 것이다 — 무엇을 어느 칸에 넣는지는 조직의 절차다.
  const counts = page.locator('[data-node-id="30:164"]')
  await expect(counts).toContainText('검토 대기')
  await expect(counts).toContainText('처리 완료')
})

test('MY-REQ-01: 행 하나를 열면 그 요청의 상세로 간다', async ({ page }) => {
  await page.goto(SCREEN)

  await page.getByRole('button', { name: /REQ-001 상태 확인/ }).click()

  await expect(page).toHaveURL(/#\/FIN-REQ-02\?requestId=PR-2026-0031/)
  await expect(page.getByRole('heading', { name: '구매 요청 상세·진행 상태' })).toBeVisible()
})

test('MY-REQ-01: 갈피는 자기가 아니라 재정이 켜진다', async ({ page }) => {
  await page.goto(SCREEN)

  // 이 화면은 재정 갈피에서 열리지만 자기가 갈피는 아니다. 켜지는 것은 재정이고,
  // 그것을 명세가 말한다(workspace.activeTabScreenId).
  // 셸의 최상위 메뉴에도 '재정'이 있다. 여기서 보는 것은 갈피 줄 쪽이다.
  const tabs = page.locator('[data-node-id="30:101"]')
  await expect(tabs.getByRole('button', { name: '재정', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('MY-REQ-01: 글 없는 조작에도 읽어 주는 이름이 있다', async ({ page }) => {
  await page.goto(SCREEN)

  // 그려지는 것은 화살표 그림뿐이다. 이름이 없으면 구현이 지어내거나 비워 둔다.
  await page.getByRole('button', { name: '행사 재정 개요로' }).click()

  await expect(page).toHaveURL(/#\/EVT-FIN-01\?eventId=E-01/)
})

test('MY-REQ-01: 인자가 없으면 아무 행사의 요청이나 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/MY-REQ-01')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('MY-REQ-01', 'eventId'))
  await expect(page.getByRole('table')).toBeHidden()
})
