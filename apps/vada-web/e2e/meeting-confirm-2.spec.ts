import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
// 종료할 수 있는 것은 진행 중인 회의다. MTG-05는 예정이라 이 모달의 배경
// (05A)이 진행 중에만 오는 조각을 못 찾고 터진다.
const END = '/#/OPS-MEET-D02?meetingId=MTG-04'
const GRANT = '/#/OPS-MEET-D03?meetingId=MTG-05&memberId=M-03'

// 회의 종료 확인(OPS-MEET-D02)과 진행 권한 부여 확인(OPS-MEET-D03).
// meeting-confirm.spec.ts의 D01·D04와 합쳐 회의 계열 확인 모달 넷이 다 찬다.
//
// **넷의 배경이 셋이다.** D01·D04는 03A, D02는 05A, D03은 04B 위에 뜬다 —
// 넷을 하나로 접지 못한 첫째 까닭이 그것이다(docs/decisions/meeting-model.md).
// 그리고 D02·D03은 그 셋의 성격이 갈리는 자리이기도 하다: 05A는 05B(진행
// 권한자)라는 변형의 대표라 그림과 주소가 어긋나 있고, 04B는 변형이 아니라
// 제 주소를 가진 화면이라 어긋날 것이 없다.
//
// 넷을 접지 못한 둘째 까닭도 여기서 보인다: 읽는 것과 보내는 것이 화면마다
// 다르다. D02는 살펴 준 한 줄만 읽고, D03은 **그리는 글 전부**를 읽는다.

test('OPS-MEET-D02: 모달 뒤에 진행 중인 그 회의가 그대로 남는다', async ({ page }) => {
  await page.goto(END)

  await expect(page.getByRole('dialog', { name: '회의를 종료할까요?' })).toBeVisible()

  // 종료가 완료가 아니라는 것을 못 박는 자리다. 회의의 상태와 회의록의 상태가
  // 다른 축이라는 사실이 이 한 문장에 걸려 있다.
  await expect(
    page.getByText(
      '종료 후 상태는 ‘완료’가 아니라 ‘정리 중’으로 변경됩니다. 회의록과 결정 내용을 확인한 뒤 정리 완료할 수 있습니다.',
    ),
  ).toBeVisible()

  // 뒤에 남는 화면. 그림이 그린 배경은 05B(진행 권한자)이지만 05B는 화면이
  // 아니라 05A의 변형이라 주소가 없다 — 명세는 05A라 적었고 화면은 그것을 따른다.
  await expect(page.locator('[data-node-id="20:946"]')).toContainText(
    '체육대회 안전 관리 최종 회의',
  )

  await page.screenshot({ path: `${SHOTS}/ops-meet-d02.png`, fullPage: true })
})

// 무엇을 '미완료'로 세는지는 회의 진행의 규칙이라 화면이 셀 수 없다. 셋을 이어
// 한 줄로 만드는 일까지 서버가 한다(meeting.endConfirm.warningNote).
test('OPS-MEET-D02: 살펴 준 한 줄은 서버가 완성해 준 것이고, 막지는 않는다', async ({
  page,
}) => {
  await page.goto(END)

  await expect(page.locator('[data-node-id="20:3456"]')).toHaveText(
    '미완료 안건 1개 · 참석 3명 · 미참가 1명',
  )

  // 미완료 안건이 남아 있어도 종료 단추는 살아 있다. 알려 줄 뿐이라는 것이
  // 카탈로그의 말이고, 그래서 이 화면에는 executeWhen이 없다.
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '회의 종료' }),
  ).toBeEnabled()
})

test('OPS-MEET-D02: 돌아가기는 진행 중이던 그 회의로 되돌린다', async ({ page }) => {
  await page.goto(END)

  await page.getByRole('dialog').getByRole('button', { name: '돌아가기' }).click()

  // 어느 회의였는지를 잃지 않는다 — 모달이 받은 인자를 그대로 넘긴다.
  await expect(page).toHaveURL(/#\/OPS-MEET-05A\?meetingId=MTG-04/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

// 보내는 것까지가 이 화면의 몫이다. **보낸 뒤 어디로 가는지는 그림에 이음이
// 없어** 명세가 onSuccess를 비워 두었고, 그래서 여기 머문다.
test('OPS-MEET-D02: 회의 종료는 실제로 보내고, 보낸 뒤 갈 곳은 아직 없다', async ({ page }) => {
  await page.goto(END)

  const end = page
    .getByRole('dialog')
    .getByRole('button', { name: /회의 종료|회의를 종료하는 중입니다/ })
  await end.click()

  // 보내는 중이라는 글은 화면이 아니라 mutations.json이 갖는다.
  await expect(end).toHaveText('회의를 종료하는 중입니다')
  await expect(end).toHaveText('회의 종료')
  await expect(page).toHaveURL(/#\/OPS-MEET-D02\?meetingId=MTG-04/)
})

test('OPS-MEET-D02: 어느 회의인지 없이 열면 아무 회의나 끝내지 않는다', async ({ page }) => {
  await page.goto('/#/OPS-MEET-D02')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('OPS-MEET-D02', 'meetingId'))
  await expect(page.getByRole('button', { name: '회의 종료' })).toHaveCount(0)
})

// **명세가 고정 글을 하나도 들지 않은 유일한 확인 모달이다.** 제목에는 사람
// 이름이 박혀 있고, 그 사람이 갖게 되는 것과 갖지 못하는 것은 '진행 권한'이라는
// 역할이 무엇이냐의 문제다 — 조직 규칙이 바뀌면 명세가 틀린다. D04(고정 카피
// 셋에 읽는 것 없음)와 정확히 반대편이다.
test('OPS-MEET-D03: 제목·설명·안내 셋이 전부 서버에서 온다', async ({ page }) => {
  await page.goto(GRANT)

  const dialog = page.getByRole('dialog')
  // 이름이 박힌 완성된 문장이다. 화면이 '{이름}에게'를 잇지 않는다.
  await expect(dialog.getByRole('heading')).toHaveText('이수현에게 진행 권한을 부여할까요?')
  await expect(dialog).toContainText(
    '이 회의에서 회의 시작·종료, 안건 진행, 의사결정 기록과 회의록 정리를 할 수 있게 됩니다.',
  )
  // 갖게 되는 것 아래에 갖지 못하는 것. 권한의 층이 셋이라는 사실이 여기 걸린다.
  await expect(page.locator('[data-node-id="20:3697"]')).toHaveText(
    '회의 수정·취소와 다른 참가자의 권한 변경은 할 수 없습니다.',
  )

  await page.screenshot({ path: `${SHOTS}/ops-meet-d03.png`, fullPage: true })
})

// **넷 중 유일하게 배경이 변형이 아니라 화면이다.** 04B가 모달이었다면 모달 위
// 모달이 됐을 자리이고, 그래서 04B는 제 주소를 갖는다.
test('OPS-MEET-D03: 모달 뒤에 진행 권한 관리 화면이 그대로 남는다', async ({ page }) => {
  await page.goto(GRANT)

  const breadcrumb = page.locator('[data-node-id="20:727"]')
  await expect(breadcrumb).toContainText('체육대회 안전 관리 최종 회의')
  await expect(breadcrumb).toContainText('진행 권한 관리')
})

test('OPS-MEET-D03: 돌아가기는 그 회의의 권한 관리로 되돌린다', async ({ page }) => {
  await page.goto(GRANT)

  await page.getByRole('dialog').getByRole('button', { name: '돌아가기' }).click()

  await expect(page).toHaveURL(/#\/OPS-MEET-04B\?meetingId=MTG-05/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('OPS-MEET-D03: 진행 권한 부여는 실제로 보내고, 보낸 뒤 갈 곳은 아직 없다', async ({
  page,
}) => {
  await page.goto(GRANT)

  const grant = page
    .getByRole('dialog')
    .getByRole('button', { name: /진행 권한 부여|진행 권한을 부여하는 중입니다/ })
  await grant.click()

  await expect(grant).toHaveText('진행 권한을 부여하는 중입니다')
  await expect(grant).toHaveText('진행 권한 부여')
  await expect(page).toHaveURL(/#\/OPS-MEET-D03\?meetingId=MTG-05&memberId=M-03/)
})

// 진행 권한은 **이 회의에만** 적용되므로 사람만으로는 무엇을 주는지 정해지지
// 않는다. 둘 중 하나만 없어도 물어볼 문장 자체가 없다.
test('OPS-MEET-D03: 누구에게 줄지 없이 열면 아무에게나 권한을 주지 않는다', async ({ page }) => {
  await page.goto('/#/OPS-MEET-D03?meetingId=MTG-05')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('OPS-MEET-D03', 'memberId'))
  await expect(page.getByRole('button', { name: '진행 권한 부여' })).toHaveCount(0)
})

// 인자는 있는데 그 사람을 못 찾는 자리. 주소로는 아무 값이나 들어올 수 있다.
// 화면이 이름을 지어내지 않는다는 것과, 무엇이라 말할지는 카탈로그가 갖고
// 있다는 것을 함께 지킨다.
test('OPS-MEET-D03: 못 찾은 사람의 이름을 화면이 지어내지 않는다', async ({ page }) => {
  await page.goto('/#/OPS-MEET-D03?meetingId=MTG-05&memberId=M-99')

  await expect(page.getByRole('status')).toHaveText('확인할 것이 없습니다')
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveCount(0)
})
