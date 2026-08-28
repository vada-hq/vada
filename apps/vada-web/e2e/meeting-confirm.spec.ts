import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const START = '/#/OPS-MEET-D01?meetingId=MTG-05'
const CANCEL = '/#/OPS-MEET-D04?meetingId=MTG-05'

// 회의 시작 확인(OPS-MEET-D01)과 회의 취소 확인(OPS-MEET-D04).
//
// **둘 다 03A 위에 뜬다.** 그림이 그린 배경은 03B(생성자)이지만 03B는 화면이
// 아니라 03A의 변형이고, overlay.screenId는 주소를 가진 화면 하나만 받는다
// (docs/decisions/meeting-model.md).
//
// 03A에서 이 모달로 들어오는 이음은 여기서 확인하지 않는다 — '회의 시작'·'회의
// 취소'는 03B(변형)의 단추이고 아직 pending이다.
//
// 넷을 하나로 접지 않기로 한 까닭이 여기서 그대로 보인다: D01은 서버가 살펴 준
// 한 줄을 읽고, D04는 아무것도 읽지 않는 대신 값을 보낸다.

test('OPS-MEET-D01: 모달 뒤에 그 회의의 상세가 그대로 남는다', async ({ page }) => {
  await page.goto(START)

  await expect(page.getByRole('dialog', { name: '회의를 시작할까요?' })).toBeVisible()
  await expect(
    page.getByText('시작하면 회의 상태가 ‘진행 중’으로 변경되고 참가자에게 ‘회의 참가’ 버튼이 활성화됩니다.'),
  ).toBeVisible()

  // 뒤에 남는 화면. 명세가 overlay.screenId로 말한 것이고, 모달이 제 배경을
  // 지어내지 않는다는 뜻이다.
  await expect(page.locator('[data-node-id="18:2889"]')).toContainText(
    '체육대회 안전 관리 최종 회의',
  )

  await page.screenshot({ path: `${SHOTS}/ops-meet-d01.png`, fullPage: true })
})

// 며칠 이른지는 예정 시각과 지금을 견줘야 아는 것이라 화면이 셀 수 없다.
// 서버가 완성한 한 줄이고, 예정 시각에 시작하면 아예 오지 않는다(optional).
test('OPS-MEET-D01: 눈여겨볼 한 줄은 서버가 완성해 준 것이다', async ({ page }) => {
  await page.goto(START)

  const warning = page.locator('[data-node-id="20:3119"]')
  await expect(warning).toHaveText(
    '예정 시간보다 7일 이른 시각입니다. 잘못 시작한 것은 아닌지 확인해 주세요.',
  )
})

test('OPS-MEET-D01: 돌아가기는 그 회의의 상세로 되돌린다', async ({ page }) => {
  await page.goto(START)

  await page.getByRole('dialog').getByRole('button', { name: '돌아가기' }).click()

  // 어느 회의였는지를 잃지 않는다 — 모달이 받은 인자를 그대로 넘긴다.
  await expect(page).toHaveURL(/#\/OPS-MEET-03A\?meetingId=MTG-05/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

// 보내는 것까지가 이 화면의 몫이다. **보낸 뒤 어디로 가는지는 그림에 이음이
// 없어** 명세가 onSuccess를 비워 두었고, 그래서 여기 머문다.
test('OPS-MEET-D01: 회의 시작은 실제로 보내고, 보낸 뒤 갈 곳은 아직 없다', async ({ page }) => {
  await page.goto(START)

  const start = page
    .getByRole('dialog')
    .getByRole('button', { name: /회의 시작|회의를 시작하는 중입니다/ })
  await start.click()

  // 보내는 중이라는 글은 화면이 아니라 mutations.json이 갖는다.
  await expect(start).toHaveText('회의를 시작하는 중입니다')
  await expect(start).toHaveText('회의 시작')
  await expect(page).toHaveURL(/#\/OPS-MEET-D01\?meetingId=MTG-05/)
})

// 다섯 확인 중 **유일하게 서버를 읽지 않는 화면**이다. 본문 글 셋이 전부 고정
// 카피라 dataSourceKey가 없고, 대신 D01에 없던 보낼 값이 하나 있다.
test('OPS-MEET-D04: 고정 카피 셋과 여러 줄 사유 칸을 그린다', async ({ page }) => {
  await page.goto(CANCEL)

  const dialog = page.getByRole('dialog', { name: '회의를 취소할까요?' })
  await expect(dialog).toContainText(
    '회의는 삭제되지 않고 취소된 기록으로 남습니다. 참가자는 더 이상 회의에 참가할 수 없습니다.',
  )
  // 별표만 있으면 '왜 필수인지'가 사라진다. 그림이 그 까닭까지 적어 두었다.
  await expect(page.locator('[data-node-id="20:4044"]')).toHaveText(
    '취소 사유를 입력해야 참가자들이 변경 내용을 이해할 수 있습니다.',
  )

  // design이 Text Area로 그린 자리다(input.multiline). 한 줄짜리로 그리면
  // '긴 글'이라는 사실이 화면에서 사라진다.
  const reason = dialog.getByRole('textbox', { name: '취소 사유*' })
  await expect(reason).toBeVisible()
  await expect(reason).toHaveJSProperty('tagName', 'TEXTAREA')

  await page.screenshot({ path: `${SHOTS}/ops-meet-d04.png`, fullPage: true })
})

test('OPS-MEET-D04: 사유가 비면 막고 그 칸을 짚는다', async ({ page }) => {
  await page.goto(CANCEL)

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /회의 취소|회의를 취소하는 중입니다/ }).click()

  await expect(page.getByText('필수 항목입니다')).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: '취소 사유*' })).toBeFocused()

  // 채우면 보낸다. 취소된 회의로 가는 이음은 그림에 없어 여기 머문다.
  await dialog.getByRole('textbox', { name: '취소 사유*' }).fill('행사 일정이 앞당겨져 회의를 열 수 없습니다.')
  const cancel = dialog.getByRole('button', { name: /회의 취소|회의를 취소하는 중입니다/ })
  await cancel.click()
  await expect(cancel).toHaveText('회의를 취소하는 중입니다')
  await expect(page.getByText('필수 항목입니다')).toHaveCount(0)
})

test('OPS-MEET-D04: 어느 회의인지 없이 열면 아무 회의나 취소하지 않는다', async ({ page }) => {
  await page.goto('/#/OPS-MEET-D04')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('OPS-MEET-D04', 'meetingId'))
  await expect(page.getByRole('textbox', { name: '취소 사유*' })).toHaveCount(0)
})
