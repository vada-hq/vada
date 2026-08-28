import { expect, test } from '@playwright/test'
import { pendingNoteAt } from './spec'

const SHOTS = 'e2e/shots'
const ROOMS = '/#/MSG-01'
const CREATE = '/#/MSG-02'
const CONVERSATION = '/#/MSG-03'

// 메시지 세 화면(MSG-01 · MSG-02 · MSG-03).
//
// **01과 03은 빈 모습만 그려졌다.** 채워진 방 목록도 채워진 대화도 와이어프레임
// 어디에도 없다. 그래서 이 파일이 단언하는 것은 '빈 카드가 있다'가 아니라
// **목록이 비었을 때 그 자리에 무엇이 대신 그려지는가**다 — 비었다는 말은
// 출처의 messages.empty가 갖고, 채우라고 권하는 단추는 itemList.emptyAction이
// 갖는다. 화면의 성질로 못 박았으면 방이 생긴 뒤에도 영영 빈 카드가 떴을 것이다.

// ── MSG-01 · 방 목록 ────────────────────────────────────────────────────────

test('MSG-01: 방이 없으면 목록 자리에 빈 안내와 만들기 단추가 대신 그려진다', async ({
  page,
}) => {
  await page.goto(ROOMS)

  // 비었다는 말은 출처가 갖는다(message.rooms의 messages.empty).
  await expect(page.getByText('아직 만들어진 메시지 방이 없습니다')).toBeVisible()
  await expect(
    page.getByRole('button', { name: '새 메시지 방 만들기' }),
  ).toBeVisible()

  // 셸의 '메시지' 메뉴가 가리키는 화면 자신이다 — 그래서 이 화면은
  // activeNavigationScreenId를 갖지 않고 자기 id로 메뉴가 켜진다.
  await expect(
    page.getByRole('navigation').getByRole('button', { name: '메시지', exact: true }),
  ).toHaveAttribute('aria-current', 'page')

  await page.screenshot({ path: `${SHOTS}/msg-01.png`, fullPage: true })
})

test('MSG-01: 빈 자리의 단추는 새 방 만들기 모달을 연다', async ({ page }) => {
  await page.goto(ROOMS)

  await page.getByRole('button', { name: '새 메시지 방 만들기' }).click()
  await expect(page).toHaveURL(/#\/MSG-02/)
  await expect(page.getByRole('dialog', { name: '새 메시지 방 만들기' })).toBeVisible()
})

// ── MSG-02 · 새 메시지 방 만들기 ────────────────────────────────────────────

// **뒤에 남는 것은 MSG-01이다.** 디자인의 루트 자식이 둘이고(셸 + 검정 스크림),
// 그 셸이 그린 것은 MSG-01과 한 글자도 다르지 않다.
test('MSG-02: 모달 뒤에 메시지 방 목록이 그대로 남는다', async ({ page }) => {
  await page.goto(CREATE)

  const dialog = page.getByRole('dialog', { name: '새 메시지 방 만들기' })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByText('부서를 통째로 고르거나, 부서를 펼쳐 필요한 사람만 고를 수 있습니다.'),
  ).toBeVisible()

  // 뒤에 남는 화면(명세의 overlay.screenId). 모달이 제 배경을 지어내지 않는다.
  await expect(page.locator('[data-node-id="30:6768"]')).toContainText(
    '아직 만들어진 메시지 방이 없습니다',
  )

  await page.screenshot({ path: `${SHOTS}/msg-02.png`, fullPage: true })
})

test('MSG-02: 분류·방 이름·대상 고르기가 그려진다', async ({ page }) => {
  await page.goto(CREATE)
  const dialog = page.getByRole('dialog')

  // 분류는 원격 목록이다 — '일반'과 행사들이 한 줄에 섞여 있어 명세가 목록을
  // 들 수 없다(message.roomCategories).
  const categories = dialog.getByRole('radiogroup', { name: '분류*' })
  await expect(categories.getByRole('radio', { name: '일반' })).toBeVisible()

  // 방 이름은 선택이다. 그 사실을 명세가 required: false로 들고, 이 프레임은
  // 그것을 '선택' 딱지로 그린다.
  await expect(dialog.getByRole('textbox', { name: '방 이름' })).toBeVisible()
  await expect(
    dialog.getByText('비워두면 선택한 구성원으로 자동 생성됩니다.'),
  ).toBeVisible()

  // 대상은 학생회 조직도를 그대로 쓴다(org.departments).
  await expect(dialog.getByRole('searchbox', { name: '이름 검색' })).toBeVisible()
  await expect(dialog.getByText('기획부', { exact: true })).toBeVisible()
})

test('MSG-02: 취소와 닫기는 둘 다 방 목록으로 되돌린다', async ({ page }) => {
  await page.goto(CREATE)

  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click()
  await expect(page).toHaveURL(/#\/MSG-01/)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.goto(CREATE)
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click()
  await expect(page).toHaveURL(/#\/MSG-01/)
})

// 떠나면서 초안을 버린다는 것을 명세가 말한다(action.scopeEvent: cancel).
test('MSG-02: 취소하고 나가면 치던 방 이름이 남지 않는다', async ({ page }) => {
  await page.goto(CREATE)

  const name = page.getByRole('dialog').getByRole('textbox', { name: '방 이름' })
  await name.fill('체육대회 운영 논의')
  await expect(name).toHaveValue('체육대회 운영 논의')

  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click()
  await expect(page).toHaveURL(/#\/MSG-01/)

  await page.goto(CREATE)
  await expect(
    page.getByRole('dialog').getByRole('textbox', { name: '방 이름' }),
  ).toHaveValue('')
})

// 필수 판정은 화면이 다시 세지 않는다 — 명세의 executeWhen이 말하고 판정은
// 한 곳에서만 돈다. **다만 '한 명 이상 고르라'는 조건은 여기 들어 있지 않다:
// 고른 대상을 담는 값이 명세에 없어 판정기가 볼 것이 없다.**
test('MSG-02: 분류를 고르지 않으면 막고 그 자리를 짚는다', async ({ page }) => {
  await page.goto(CREATE)

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /방 만들기|메시지 방을 만드는 중입니다/ }).click()

  await expect(page.getByText('필수 항목입니다')).toBeVisible()
})

// 보내는 것까지가 이 화면의 몫이다. **만든 뒤 어디로 가는지는 그림에 이음이
// 없어** 명세가 onSuccess를 비워 두었고, 그래서 여기 머물며 그 까닭을 내놓는다.
test('MSG-02: 분류를 고르고 보내면 머물면서 갈 곳이 없다고 말한다', async ({ page }) => {
  await page.goto(CREATE)
  const dialog = page.getByRole('dialog')

  await dialog.getByRole('radio', { name: '일반' }).click()
  await dialog.getByRole('button', { name: /방 만들기|메시지 방을 만드는 중입니다/ }).click()

  await expect(page).toHaveURL(/#\/MSG-02/)
  await expect(
    page.getByText('방을 만든 뒤 어느 화면으로 가는지가 디자인에 없습니다', { exact: false }),
  ).toBeVisible()
})

// 줄의 두 단추는 고른 대상을 담는 조작인데, **담은 것이 어느 값으로 모이는지를
// 말할 어휘가 없다.** 지어내지 않고 명세가 그 사실을 적어 두었으므로 화면은
// 그 글을 내놓는다.
test('MSG-02: 부서 줄의 두 단추는 아직 정해지지 않았다고 말한다', async ({ page }) => {
  await page.goto(CREATE)
  const dialog = page.getByRole('dialog')

  await dialog.getByRole('button', { name: '부서 전체' }).first().click()
  await expect(page.getByText(pendingNoteAt('MSG-02', '30:6945'))).toBeVisible()

  await dialog.getByRole('button', { name: '부서 펼치기' }).first().click()
  await expect(page.getByText(pendingNoteAt('MSG-02', '30:6947'))).toBeVisible()
})

// ── MSG-03 · 대화 ───────────────────────────────────────────────────────────

// 빈 상태의 글이 '주고받은 말이 없다'가 아니라 **'들어갈 방이 없다'**고 말한다.
// MSG-01의 빈 상태와 같은 사실을 다른 말로 말하는 자리다.
test('MSG-03: 방이 없으면 대화 자리에 빈 안내와 메시지로 가는 단추가 그려진다', async ({
  page,
}) => {
  await page.goto(CONVERSATION)

  await expect(page.getByText('아직 대화할 방이 없습니다')).toBeVisible()
  await expect(page.getByRole('button', { name: '메시지로 이동' })).toBeVisible()

  // 머리는 현재 위치 경로가 아니다 — 조각이 하나뿐이라 경로가 될 수 없다.
  // meta.eyebrow와 제목이 그 자리다.
  await expect(page.getByRole('heading', { name: '대화' })).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/msg-03.png`, fullPage: true })
})

// 이 화면은 메뉴가 가리키는 화면이 아니다. 명세가 어느 메뉴 아래인지를 말하고
// (activeNavigationScreenId: MSG-01) 화면은 그것을 읽기만 한다.
test('MSG-03: 셸의 메시지 메뉴가 켜져 있다', async ({ page }) => {
  await page.goto(CONVERSATION)

  await expect(
    page.getByRole('navigation').getByRole('button', { name: '메시지', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
})

test('MSG-03: 메시지로 이동은 방 목록으로 데려간다', async ({ page }) => {
  await page.goto(CONVERSATION)

  await page.getByRole('button', { name: '메시지로 이동' }).click()
  await expect(page).toHaveURL(/#\/MSG-01/)
  await expect(page.getByText('아직 만들어진 메시지 방이 없습니다')).toBeVisible()
})
