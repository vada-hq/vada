import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'

// QR 참석 확인 두 화면(EXT-01A · EXT-01B).
//
// **학생회 밖에서 보는 첫 화면들이다.** 로그인한 사람이 없고 셸도 없다 —
// 무엇을 볼 수 있는지는 주소가 실어 온 토큰만이 정한다. 그래서 이 파일의 모든
// 검사가 토큰으로 화면을 열고, 토큰이 갈리면 보이는 것도 갈리는지를 본다.
//
// 토큰이 여섯인 까닭: 결과가 여섯이고 **서로 배타적**이라 한 사람에게 하나만
// 온다. 하나만 두면 '토큰마다 다르다'가 말뿐이 된다.
const OPEN = 'A7K2M9' // 폼이 열리고, 내면 참석 완료
const MISMATCH = 'B3N8P4' // 폼이 열리고, 내면 명단 불일치
const ALREADY = 'C5Q1R6' // 이미 참석 처리됨
const UNMET = 'D8W4X2' // 조건 미충족
const OUT_OF_WINDOW = 'E2Y7Z5' // 체크인 시간이 아니라 폼이 열리지 않는다
const DEACTIVATED = 'F6H1J3' // 꺼진 QR이라 폼이 열리지 않는다

const form = (token: string) => `/#/EXT-01A?checkInToken=${token}`
const result = (token: string) => `/#/EXT-01B?checkInToken=${token}`

// ── EXT-01A · 참석 확인 폼 ──────────────────────────────────────────────────

test('EXT-01A: 토큰이 가리키는 행사와 체크인 시간대를 보여주고 이름·학번을 받는다', async ({
  page,
}) => {
  await page.goto(form(OPEN))

  await expect(page.locator('[data-node-id="30:7361"]')).toContainText(
    '2026 소프트웨어융합대학 체육대회',
  )
  await expect(page.locator('[data-node-id="30:7361"]')).toContainText('체크인 가능')
  await expect(page.locator('[data-node-id="30:7361"]')).toContainText('09:30 ~ 11:00')
  await expect(page.locator('[data-node-id="30:7369"]')).toHaveText(
    '참가 신청 시 입력한 이름과 학번을 정확히 입력해 주세요.',
  )

  await expect(page.getByRole('textbox', { name: '이름*' })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: '학번*' })).toBeVisible()
  await expect(page.getByRole('button', { name: '참석 확인' })).toBeVisible()

  // 학생회 밖에서 보는 화면이라 셸이 없다(명세의 viewer: external).
  await expect(page.getByRole('navigation')).toHaveCount(0)

  await page.screenshot({ path: `${SHOTS}/ext-01a.png`, fullPage: true })
})

// 필수 판정은 화면이 다시 세지 않는다 — 명세의 executeWhen이 말하고 판정은
// 한 곳에서만 돈다(packages/contracts의 button-execution).
test('EXT-01A: 이름과 학번이 비면 막고 첫 빈 칸을 짚는다', async ({ page }) => {
  await page.goto(form(OPEN))

  await page.getByRole('button', { name: '참석 확인' }).click()

  await expect(page.getByText('필수 항목입니다')).toHaveCount(2)
  await expect(page.getByRole('textbox', { name: '이름*' })).toBeFocused()
  await expect(page).toHaveURL(new RegExp(`EXT-01A`))
})

test('EXT-01A: 이름과 학번을 내면 같은 토큰의 결과 화면으로 간다', async ({ page }) => {
  await page.goto(form(OPEN))

  await page.getByRole('textbox', { name: '이름*' }).fill('김바다')
  await page.getByRole('spinbutton', { name: '학번*' }).fill('2022123456')
  await page.getByRole('button', { name: '참석 확인' }).click()

  await expect(page).toHaveURL(new RegExp(`EXT-01B\\?checkInToken=${OPEN}`))
  await expect(page.locator('[data-node-id="30:7398"]')).toContainText('참석 완료')
})

// **열자마자 막는다**(사람이 정한 것: docs/decisions/product-decisions.md).
// 헛되이 입력하게 하지 않으므로 칸이 아예 없어야 한다 — 비활성이 아니라 없음이다.
test('EXT-01A: 꺼진 QR은 이름·학번 칸을 아예 그리지 않고 까닭만 보여준다', async ({ page }) => {
  await page.goto(form(DEACTIVATED))

  const blocked = page.getByRole('status')
  await expect(blocked).toContainText('비활성화된 QR')
  await expect(blocked).toContainText('이 QR은 더 이상 사용할 수 없습니다.')

  await expect(page.getByRole('textbox', { name: '이름*' })).toHaveCount(0)
  await expect(page.getByRole('spinbutton', { name: '학번*' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '참석 확인' })).toHaveCount(0)

  await page.screenshot({ path: `${SHOTS}/ext-01a-blocked.png`, fullPage: true })
})

test('EXT-01A: 체크인 시간이 아니어도 같은 자리에서 막힌다', async ({ page }) => {
  await page.goto(form(OUT_OF_WINDOW))

  await expect(page.getByRole('status')).toContainText('체크인 시간 전·후')
  await expect(page.getByRole('textbox', { name: '이름*' })).toHaveCount(0)
})

// 인자가 아예 없는 것과 인자가 가리키는 것이 없는 것은 다르고, 둘 다 조용히
// 넘어가서는 안 된다. 무엇을 보여줄지는 명세가 든다(params[].missingNote).
test('EXT-01A: 토큰 없이 열면 그 사실을 드러낸다', async ({ page }) => {
  await page.goto('/#/EXT-01A')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EXT-01A', 'checkInToken'))
})

test('EXT-01A: 없는 토큰으로 열면 찾지 못했다고 말한다', async ({ page }) => {
  await page.goto(form('ZZZZZZ'))

  await expect(page.getByRole('status')).toContainText('이 참석 확인 링크를 찾을 수 없습니다')
})

// ── EXT-01B · 참석 확인 결과 ────────────────────────────────────────────────

// **한 프레임이 한 자리의 값 여섯을 나란히 그렸다.** 서로 배타적이므로 화면은
// 카드 한 장만 그린다 — 여섯이 다 보이면 그 사람은 자기 결과를 알 수 없다.
test('EXT-01B: 결과 카드는 토큰마다 하나뿐이다', async ({ page }) => {
  for (const [token, label, note] of [
    [OPEN, '참석 완료', '2026. 08. 20 09:47 체크인되었습니다.'],
    [MISMATCH, '참가자 명단 불일치', '입력하신 정보가 명단에 없습니다. 운영진에게 문의해 주세요.'],
    [ALREADY, '이미 참석 처리됨', '이미 참석 확인이 완료된 상태입니다.'],
    [UNMET, '조건 미충족', '참가비 미납 또는 신청 미완료 상태입니다.'],
    [OUT_OF_WINDOW, '체크인 시간 전·후', '체크인 가능 시간이 아닙니다. (09:30 ~ 11:00)'],
    [DEACTIVATED, '비활성화된 QR', '이 QR은 더 이상 사용할 수 없습니다.'],
  ] as const) {
    await page.goto(result(token))

    const card = page.locator('[data-node-id="30:7398"]')
    await expect(card).toHaveCount(1)
    await expect(card).toContainText(label)
    await expect(card).toContainText(note)
  }

  await page.screenshot({ path: `${SHOTS}/ext-01b.png`, fullPage: true })
})

// **맨 위의 '참석 확인 결과'는 갤러리 캡션이다** — 프레임 이름의 꼬리를 적은
// 것이고 화면인 셋에는 같은 자리가 없다. 옮기면 화면에 없는 글이 하나 생긴다.
test('EXT-01B: 갤러리 캡션을 화면으로 옮기지 않는다', async ({ page }) => {
  await page.goto(result(OPEN))

  await expect(page.getByText('참석 확인 결과')).toHaveCount(0)
})

// **회색 둘이 다른 그림이다.** 톤으로는 못 가른다 — 이것이 summary.iconField가
// 필요하다고 보고한 자리이고, 지금은 화면이 iconName을 직접 읽어 가른다.
test('EXT-01B: 같은 회색이어도 시계와 X로 그림이 갈린다', async ({ page }) => {
  await page.goto(result(OUT_OF_WINDOW))
  await expect(page.locator('[data-asset-node-id="30:7440"]')).toBeVisible()

  await page.goto(result(DEACTIVATED))
  await expect(page.locator('[data-asset-node-id="30:7450"]')).toBeVisible()
})

// **그림에 없는 단추다.** 이름이 명단과 다를 때 QR을 다시 찍지 않고 폼으로
// 돌아갈 수 있어야 한다고 사람이 정했다(docs/decisions/product-decisions.md).
test('EXT-01B: 다시 입력은 같은 토큰의 폼으로 돌려보낸다', async ({ page }) => {
  await page.goto(result(MISMATCH))

  await page.getByRole('button', { name: '다시 입력' }).click()

  await expect(page).toHaveURL(new RegExp(`EXT-01A\\?checkInToken=${MISMATCH}`))
  await expect(page.getByRole('textbox', { name: '이름*' })).toBeVisible()
})

test('EXT-01B: 토큰 없이 열면 그 사실을 드러낸다', async ({ page }) => {
  await page.goto('/#/EXT-01B')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EXT-01B', 'checkInToken'))
})
