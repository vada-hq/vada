import { expect, test } from '@playwright/test'

const SHOTS = 'e2e/shots'

// OPS-MEET-01A는 운영 허브의 '회의' 카드로 도달한다. 주소로 바로 열지 않고 눌러서
// 가는 이유는 그 이동이 이번에 새로 이어진 길이기 때문이다(OPS-00의 pending 해소).
async function goToMeetings(page: import('@playwright/test').Page) {
  await page.goto('/#/OPS-00')
  await page.getByRole('button', { name: /회의 목록 보기/ }).click()
}

test('OPS-MEET-01A: 운영 허브의 회의 카드에서 도달한다', async ({ page }) => {
  await goToMeetings(page)

  await expect(page.getByRole('heading', { name: '회의', level: 1 })).toBeVisible()
  await expect(page.getByText('확인 필요한 회의 2건')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/ops-meet-01a.png`, fullPage: true })
})

test('OPS-MEET-01A: 회의가 행사별로 묶여 오고 묶음마다 건수를 센다', async ({ page }) => {
  await goToMeetings(page)

  // 묶음 수도 묶음 안 항목 수도 데이터가 정한다 — 칸반의 열(명세에 고정)과 다르다.
  await expect(page.getByRole('button', { name: /정기·상시 회의/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /2026 소프트웨어융합대학 체육대회/ })).toBeVisible()
  await expect(page.getByText('총 3건')).toBeVisible()
  await expect(page.getByText('가장 가까운 회의: 07.22 (수) 18:00')).toBeVisible()
})

test('OPS-MEET-01A: 묶음을 접으면 그 회의만 사라진다', async ({ page }) => {
  await goToMeetings(page)

  const meeting = page.getByText('학생회 정기 운영회의')
  await expect(meeting).toBeVisible()

  await page.getByRole('button', { name: /정기·상시 회의/ }).click()
  await expect(meeting).toBeHidden()
  // 접힘은 화면 안의 상태다 — 다른 묶음은 그대로다.
  await expect(page.getByText('체육대회 운영 점검 회의')).toBeVisible()
})

test('OPS-MEET-01A: 검색은 묶음이 아니라 회의를 거른다', async ({ page }) => {
  await goToMeetings(page)

  await page.getByRole('searchbox', { name: '회의명 검색' }).fill('안전')

  await expect(page.getByText('안전 관리 최종 회의')).toBeVisible()
  // 남는 회의가 없는 묶음은 통째로 사라진다. 빈 묶음 머리만 남으면 안 된다.
  await expect(page.getByRole('button', { name: /정기·상시 회의/ })).toBeHidden()
  await expect(page.getByText('총 1건')).toBeVisible()
})

test('OPS-MEET-01A: 항목의 버튼은 문구와 강조도를 데이터에서 받는다', async ({ page }) => {
  await goToMeetings(page)

  // 진행 중인 회의만 앞세운다(primary). 나머지는 같은 자리에 다른 문구다.
  const back = page.getByRole('button', { name: '회의로 돌아가기' })
  await expect(back).toBeVisible()
  await expect(page.getByRole('button', { name: '회의록 보기' })).toBeVisible()
  await expect(page.getByRole('button', { name: '취소 내용 보기' })).toBeVisible()

  // **줄마다 가는 곳이 다르다.** 상태가 정하고(detailKind) 갈 곳은 명세가 든다 —
  // 진행 중인 회의는 진행 중 화면으로, 완료된 회의는 회의록으로 간다.
  await back.click()
  await expect(page).toHaveURL(/#\/OPS-MEET-05A\?meetingId=MTG-04/)
})

test('OPS-MEET-01A: 완료된 회의는 회의록으로 간다', async ({ page }) => {
  await goToMeetings(page)

  await page.getByRole('button', { name: '회의록 보기' }).click()

  await expect(page).toHaveURL(/#\/OPS-MEET-07\?meetingId=MTG-01/)
})

test('OPS-MEET-01A: 취소된 회의는 취소된 회의 상세로 간다', async ({ page }) => {
  await goToMeetings(page)

  await page.getByRole('button', { name: '취소 내용 보기' }).click()

  await expect(page).toHaveURL(/#\/OPS-MEET-09\?meetingId=MTG-07/)
})
