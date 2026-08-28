import { expect, test } from '@playwright/test'
import { missingNoteOf, pendingNoteOf } from './spec'

const SHOTS = 'e2e/shots'

// OPS-MEET-09는 **취소된 회의**의 상세다. 상태가 다른 화면을 다시 그린 변형이
// 아니라 제 화면이다 — 취소는 되돌릴 수 없어 조작이 하나도 없고, 대신 대체
// 회의로 잇는 자리가 있다(docs/decisions/meeting-model.md).
//
// 어느 회의인지는 화면 안에 없고 주소가 실어 온다. 그래서 화면 하나만 따로 여는
// 성질이 유지된다.
const CANCELLED = '/#/OPS-MEET-09?meetingId=MTG-07'

test('OPS-MEET-09: 화면 인자로 취소된 회의 한 건을 집어 온다', async ({ page }) => {
  await page.goto(CANCELLED)

  await expect(page.getByRole('heading', { name: '가을 축제 1차 준비회의', level: 1 })).toBeVisible()
  // 상태 이름은 명세에 없다 — 서버가 준 status가 그대로 딱지에 그려진다.
  await expect(page.getByText('취소', { exact: true })).toBeVisible()
  await expect(page.getByText('이 회의는 취소되었습니다')).toBeVisible()
  // 취소된 회의의 일시는 '원래 예정 일시'로 그려진다. 라벨은 이 화면의 카피이고
  // 값은 예정 회의와 같은 조각(scheduledAt)이다.
  await expect(page.getByText('원래 예정 일시')).toBeVisible()
  await expect(page.getByText('2026.08.05 13:00')).toBeVisible()
  await expect(page.getByText('15명')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/ops-meet-09.png`, fullPage: true })
})

test('OPS-MEET-09: 인자가 없으면 아무 회의나 대신 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/OPS-MEET-09')

  // 조용한 대체는 명세의 구멍을 숨긴다. FIN-REQ-02·EVT-TASK-02가 그 선례다.
  await expect(page.getByRole('alert')).toContainText(missingNoteOf('OPS-MEET-09', 'meetingId'))
  await expect(
    page.getByRole('heading', { name: '가을 축제 1차 준비회의', level: 1 }),
  ).toBeHidden()
})

test('OPS-MEET-09: 없는 회의 id는 조용히 다른 회의로 대신하지 않는다', async ({ page }) => {
  await page.goto('/#/OPS-MEET-09?meetingId=MTG-없는것')

  // 인자가 아예 없는 것과 인자가 가리키는 것이 없는 것은 다르다. 뭐라고 할지는
  // 카탈로그가 이미 갖고 있다(meeting.detail의 messages.empty).
  await expect(page.getByRole('alert')).toContainText('회의를 찾을 수 없습니다')
  await expect(
    page.getByRole('heading', { name: '가을 축제 1차 준비회의', level: 1 }),
  ).toBeHidden()
})

test('OPS-MEET-09: 취소 기록은 누가 언제 취소했는지를 남긴다', async ({ page }) => {
  await page.goto(CANCELLED)

  await expect(page.getByRole('heading', { name: '취소 기록' })).toBeVisible()
  await expect(page.getByText('취소 사유')).toBeVisible()
  await expect(page.getByText('취소 처리')).toBeVisible()
  await expect(page.getByText('김바다 · 기획부')).toBeVisible()
  await expect(page.getByText('2026.07.29 11:20')).toBeVisible()
})

test('OPS-MEET-09: 되돌리는 단추는 없고 대체 회의로 가는 문만 있다', async ({ page }) => {
  await page.goto(CANCELLED)

  // 취소는 되돌릴 수 없다. 본문의 조작이 하나뿐이라는 것이 그 사실의 모습이다.
  const main = page.getByRole('main')
  await expect(main.getByRole('button')).toHaveCount(1)

  // **대체 회의로 간다.** 그 회의의 id는 화면의 입력 칸에도 주소에도 없고,
  // 이 화면이 읽은 한 건의 조각이다(sourceField).
  await main.getByRole('button', { name: /새 회의 상세 보기/ }).click()
  await expect(page).toHaveURL(/#\/OPS-MEET-03A\?meetingId=MTG-08/)
  await expect(
    page.getByRole('heading', { name: '가을 축제 운영 방향 회의', level: 1 }),
  ).toBeVisible()
})
