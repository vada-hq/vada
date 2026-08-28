import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const CREATE = '/#/EVT-00B'
const END_PERMISSION = '/#/EVT-02C?eventId=E-01'
const COMPLETE = '/#/EVT-02E?eventId=E-02'

// 행사 갈래의 겹쳐 뜨는 화면 셋(EVT-00B · EVT-02C · EVT-02E).
//
// 회의의 확인 모달 넷과 같은 틀 위에 서지만 셋이 서로 다른 일을 한다 —
// 00B는 값을 받아 보내고, 02C는 아무것도 보내지 않는 알림이며, 02E는 서버가
// 살펴 준 것을 보여주되 **막지 않는다.**
//
// 뒤에 남는 화면은 명세의 overlay.screenId가 정한다. 모달이 제 배경을
// 지어내지 않는다는 뜻이고, 그것이 이 파일이 매번 배경을 함께 단언하는 까닭이다.

// ── EVT-00B · 새 행사 만들기 ────────────────────────────────────────────────

// **뒤에 남는 것은 EVT-00A다.** 그림이 그린 배경은 EVT-00A2(새 행사를 만들 수 있는
// 사람이 보는 그림)이지만 그것은 화면이 아니라 변형이라 주소가 없다.
test('EVT-00B: 행사명 하나만 받고 뒤에는 행사 목록이 남는다', async ({ page }) => {
  await page.goto(CREATE)

  const dialog = page.getByRole('dialog', { name: '새 행사 만들기' })
  await expect(dialog).toBeVisible()

  // 나머지를 여기서 묻지 않는다는 사실을 명세가 helperText와 안내 상자로 든다.
  await expect(dialog.getByRole('textbox', { name: '행사명 또는 가칭*' })).toBeVisible()
  await expect(
    page.getByText('일시·장소·참가비·운영 조직은 행사 공간에서 나중에 입력할 수 있습니다.'),
  ).toBeVisible()
  await expect(page.locator('[data-node-id="20:4663"]')).toHaveText(
    '행사 공간을 먼저 만들고, 회의와 업무를 진행하면서 정보를 점진적으로 채울 수 있습니다.',
  )

  // 뒤에 남는 화면. 행사 목록이 그대로 남는다(명세의 overlay.screenId).
  await expect(page.locator('[data-node-id="20:4167"]')).toContainText(
    '2026 소프트웨어융합대학 체육대회',
  )

  await page.screenshot({ path: `${SHOTS}/evt-00b.png`, fullPage: true })
})

test('EVT-00B: 취소와 닫기는 둘 다 행사 목록으로 되돌린다', async ({ page }) => {
  await page.goto(CREATE)

  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click()
  await expect(page).toHaveURL(/#\/EVT-00A/)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.goto(CREATE)
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click()
  await expect(page).toHaveURL(/#\/EVT-00A/)
})

// **떠나면서 초안을 버린다는 것을 명세가 말한다**(action.scopeEvent: cancel).
// 이 자리가 없던 동안 스코프는 `clearOn: ['complete','cancel']`이라 선언해 두고도
// cancel을 낼 방법이 없었다 — 열다섯 스코프가 그렇게 말했고 실제로 내는 곳은
// 한 곳뿐이었다. 취소하고 나갔다 다시 열면 지난번에 치던 이름이 그대로 있었다.
test('EVT-00B: 취소하고 나가면 치던 행사명이 남지 않는다', async ({ page }) => {
  await page.goto(CREATE)

  const name = page.getByRole('dialog').getByRole('textbox', { name: '행사명 또는 가칭*' })
  await name.fill('가을 축제')
  await expect(name).toHaveValue('가을 축제')

  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click()
  await expect(page).toHaveURL(/#\/EVT-00A/)

  await page.goto(CREATE)
  await expect(
    page.getByRole('dialog').getByRole('textbox', { name: '행사명 또는 가칭*' }),
  ).toHaveValue('')
})

// 필수 판정은 화면이 다시 세지 않는다 — 명세의 executeWhen이 말하고 판정은
// 한 곳에서만 돈다.
test('EVT-00B: 행사명이 비면 막고 그 칸을 짚는다', async ({ page }) => {
  await page.goto(CREATE)

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /행사 만들기|행사를 만드는 중입니다/ }).click()

  await expect(page.getByText('필수 항목입니다')).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: '행사명 또는 가칭*' })).toBeFocused()
})

// 보내는 것까지가 이 화면의 몫이다. **만든 뒤 어디로 가는지는 그림에 이음이
// 없어** 명세가 onSuccess를 비워 두었고, 그래서 여기 머물며 그 까닭을 내놓는다.
test('EVT-00B: 행사 만들기는 실제로 보내고, 보낸 뒤 갈 곳은 아직 없다', async ({ page }) => {
  await page.goto(CREATE)

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '행사명 또는 가칭*' }).fill('2026 학부 체육대회')

  const create = dialog.getByRole('button', { name: /행사 만들기|행사를 만드는 중입니다/ })
  await create.click()

  // 보내는 중이라는 글은 화면이 아니라 mutations.json이 갖는다.
  await expect(create).toHaveText('행사를 만드는 중입니다')
  await expect(create).toHaveText('행사 만들기')
  await expect(page).toHaveURL(/#\/EVT-00B/)
  // 갈 곳이 아직 없다는 사실을 적어만 두고 안 보여주면 아무 일도 안 일어난 것처럼 보인다.
  await expect(dialog.getByRole('status')).toContainText('디자인에 없습니다')
})

// ── EVT-02C · 행사 종료 권한 없음 ───────────────────────────────────────────

// **역할 이름을 명세도 화면도 들지 않는다.** 제목도 안내도 서버가 완성해 온다
// (event.endPermission). 여기 적으면 조직 규칙이 바뀔 때마다 화면이 조용히 틀린다.
test('EVT-02C: 제목과 권한 안내가 모두 서버가 준 글이다', async ({ page }) => {
  await page.goto(END_PERMISSION)

  await expect(page.locator('[data-node-id="20:5687"]')).toHaveText(
    '이 행사를 종료할 권한이 없습니다',
  )
  await expect(page.locator('[data-node-id="20:5689"]')).toHaveText(
    '행사 종료는 행사 운영 조직 관리자 또는 회장단만 할 수 있습니다.',
  )

  // 알리기만 하는 모달이라 보낼 것도 고를 것도 없다 — 문이 하나뿐이다.
  await expect(page.getByRole('dialog').getByRole('button')).toHaveCount(1)

  // 뒤에 남는 화면은 행사 개요다(명세의 overlay.screenId).
  await expect(page.locator('[data-node-id="20:4842"]')).toContainText('행사 기본 정보')

  await page.screenshot({ path: `${SHOTS}/evt-02c.png`, fullPage: true })
})

test('EVT-02C: 행사 개요로는 그 행사의 개요로 되돌린다', async ({ page }) => {
  await page.goto(END_PERMISSION)

  await page.getByRole('dialog').getByRole('button', { name: '행사 개요로' }).click()

  // 어느 행사였는지를 잃지 않는다 — 모달이 받은 인자를 그대로 넘긴다.
  await expect(page).toHaveURL(/#\/EVT-02\?eventId=E-01/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('EVT-02C: 어느 행사인지 없이 열면 남의 행사의 권한을 읽지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-02C')

  // 뒤에 남는 화면도 인자 없이 열리므로 저마다 제 알림을 낸다. 이 모달의 것을 짚는다.
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    missingNoteOf('EVT-02C', 'eventId'),
  )
  await expect(page.getByText('이 행사를 종료할 권한이 없습니다')).toHaveCount(0)
})

// ── EVT-02E · 행사 완료 처리 확인 ───────────────────────────────────────────

// **살펴 준 한 줄은 막지 않는다.** 미완료 업무가 남아 있어도 알려 줄 뿐이다
// (meeting.endConfirm과 같은 자리). 무엇을 남은 것으로 세는지는 행사 운영의
// 규칙이라 서버가 완성한 한 줄로 온다.
test('EVT-02E: 남은 것을 알려 주되 막지 않는다', async ({ page }) => {
  await page.goto(COMPLETE)

  const dialog = page.getByRole('dialog', { name: '아직 정리되지 않은 항목이 있습니다' })
  await expect(dialog).toBeVisible()

  await expect(page.locator('[data-node-id="20:6339"]')).toContainText('미완료 업무 6건')
  await expect(page.locator('[data-node-id="20:6347"]')).toHaveText(
    '완료 처리 후에도 행사 기록은 열람할 수 있습니다. 남은 항목을 확인한 뒤 완료하는 것을 권장합니다.',
  )

  // 뒤에 남는 화면은 후속 정리 중인 행사의 개요다(명세의 overlay.screenId).
  await expect(page.getByText('행사는 종료되었으며 후속 정리가 진행 중입니다.')).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/evt-02e.png`, fullPage: true })
})

// **완료 처리 단추를 그린 프레임이 없다.** 되돌아가는 단추 오른쪽 자리를 권한
// 안내가 채우고 있다 — 지금 보는 사람이 회장단이 아니기 때문이다. 없는 단추를
// 지어내면 그것이 계약이 된다.
test('EVT-02E: 완료 처리 단추 자리를 권한 안내가 채운다', async ({ page }) => {
  await page.goto(COMPLETE)

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button')).toHaveCount(1)
  await expect(page.locator('[data-node-id="20:6352"]')).toHaveText(
    '행사 완료 처리는 회장단만 할 수 있습니다.',
  )
})

test('EVT-02E: 계속 정리하기는 그 행사의 후속 정리로 되돌린다', async ({ page }) => {
  await page.goto(COMPLETE)

  await page.getByRole('dialog').getByRole('button', { name: '계속 정리하기' }).click()

  await expect(page).toHaveURL(/#\/EVT-02D\?eventId=E-02/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('EVT-02E: 어느 행사인지 없이 열면 아무 행사나 완료 처리하지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-02E')

  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    missingNoteOf('EVT-02E', 'eventId'),
  )
  await expect(page.getByText('미완료 업무 6건')).toHaveCount(0)
})
