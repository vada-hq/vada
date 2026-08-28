import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const QR = '/#/EVT-04B?eventId=E-01'
const QR_NONE = '/#/EVT-04B?eventId=E-03'
const BASICS = '/#/EVT-02B?eventId=E-01'

// 행사 갈래의 겹쳐 뜨는 화면 둘(EVT-04B · EVT-02B).
//
// 둘 다 모달이지만 뒤에 남는 화면이 다르다 - QR은 참가자 명단(EVT-04) 위에 뜨고
// 기본정보 편집은 행사 개요(EVT-02) 위에 뜬다. 그것은 화면이 정하는 것이 아니라
// 명세의 overlay.screenId가 정한다. 그래서 이 파일은 매번 배경을 함께 단언한다.

// ── EVT-04B · 참석 확인 QR ──────────────────────────────────────────────────

// QR은 **행사 상태와 따로 켜고 끈다.** 기획 중인 행사인데 QR은 활성 중이고, 그
// 사실은 행사 상태에서 유도할 수 없어 서버가 따로 준다.
test('EVT-04B: QR 상태와 체크인 시간은 서버가 주고 뒤에는 참가자 명단이 남는다', async ({
  page,
}) => {
  await page.goto(QR)

  const dialog = page.getByRole('dialog', { name: '참석 확인 QR' })
  await expect(dialog).toBeVisible()

  await expect(dialog.getByText('활성 중')).toBeVisible()
  await expect(dialog.getByText('시작', { exact: true })).toBeVisible()
  await expect(dialog.getByText('종료', { exact: true })).toBeVisible()
  await expect(
    dialog.getByText(
      '참가자는 휴대폰 기본 카메라로 촬영합니다. 로그인이나 앱 설치가 필요 없습니다.',
    ),
  ).toBeVisible()

  // 뒤에 남는 화면. 참가자 명단이 그대로 남는다(명세의 overlay.screenId).
  await expect(page.locator('[data-node-id="20:7707"]')).toContainText('2022111111')

  await page.screenshot({ path: `${SHOTS}/evt-04b.png`, fullPage: true })
})

test('EVT-04B: 닫기는 참가자 명단으로 되돌린다', async ({ page }) => {
  await page.goto(QR)

  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click()
  await expect(page).toHaveURL(/#\/EVT-04\?eventId=E-01/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('EVT-04B: 인자가 없으면 아무 행사의 QR도 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-04B')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-04B', 'eventId'))
  await expect(page.getByText('활성 중')).toHaveCount(0)
})

// 아직 QR을 만들지 않은 행사가 있다. 그때 무엇이라 말할지는 화면이 짓지 않는다 -
// 카탈로그의 messages.empty가 이미 갖고 있다.
test('EVT-04B: QR이 아직 없으면 카탈로그의 말로 답한다', async ({ page }) => {
  await page.goto(QR_NONE)

  await expect(page.getByText('아직 만들어진 QR이 없습니다')).toBeVisible()
  await expect(page.getByRole('button', { name: '재생성' })).toHaveCount(0)
})

// 받아 가는 것은 pending이 아니다 - 무엇을 받아 가는지 정해져 있고, 명세가 아는
// 것은 어느 파일인가까지다(downloadField).
test('EVT-04B: QR 다운로드는 어느 파일을 받아 가는지 드러낸다', async ({ page }) => {
  await page.goto(QR)

  await page.getByRole('button', { name: 'QR 다운로드' }).click()
  await expect(page.getByRole('status')).toContainText('QR 다운로드:')
  await expect(page).toHaveURL(/#\/EVT-04B\?eventId=E-01/)
})

// 재생성·비활성화는 **보내고 그 자리에 머문다**(명세의 onSuccess가 비어 있다).
// 새로 만든 QR도 꺼진 QR도 같은 자리에 다시 그려진다.
test('EVT-04B: 재생성과 비활성화는 보내고 그 자리에 머문다', async ({ page }) => {
  await page.goto(QR)

  await page.getByRole('button', { name: '재생성' }).click()
  await expect(page.getByRole('dialog', { name: '참석 확인 QR' })).toBeVisible()
  await expect(page).toHaveURL(/#\/EVT-04B\?eventId=E-01/)

  await page.getByRole('button', { name: '비활성화' }).click()
  await expect(page.getByRole('dialog', { name: '참석 확인 QR' })).toBeVisible()
  await expect(page.getByText('활성 중')).toBeVisible()
  await expect(page).toHaveURL(/#\/EVT-04B\?eventId=E-01/)
})

// ── EVT-02B · 행사 기본정보 수정 ────────────────────────────────────────────

// 고칠 화면은 고칠 것을 먼저 읽어 온다(명세의 draftFrom). event.basics가 아니라
// event.basicsDraft다 - 저기는 '납부자 무료 / 미납자 5000원'이라는 한 줄을 주고
// 여기는 고칠 칸 하나하나를 준다.
test('EVT-02B: 칸이 초안으로 채워지고 뒤에는 행사 개요가 남는다', async ({ page }) => {
  await page.goto(BASICS)

  const panel = page.getByRole('dialog', { name: '행사 기본정보 수정' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText('저장하면 일정·참여 설문에 자동 반영됩니다')).toBeVisible()

  await expect(panel.getByRole('textbox', { name: '행사명' })).toHaveValue(
    '2026 소프트웨어융합대학 체육대회',
  )
  await expect(panel.getByRole('textbox', { name: '장소', exact: true })).toHaveValue('ERICA 체육관')
  await expect(panel.getByRole('textbox', { name: '주소' })).toHaveValue(
    '경기 안산시 상록구 한양대학로 55',
  )
  await expect(panel.getByRole('spinbutton', { name: '미납자 금액' })).toHaveValue('5000')
  await expect(panel.getByRole('spinbutton', { name: '정원 인원' })).toHaveValue('200')

  // 뒤에 남는 화면. 행사 개요가 그대로 남는다(명세의 overlay.screenId).
  await expect(page.locator('[data-node-id="20:4842"]')).toContainText('납부자 무료 / 미납자 5000원')

  await page.screenshot({ path: `${SHOTS}/evt-02b.png`, fullPage: true })
})

// 한 줄과 칸 하나하나가 갈리는 자리. 개요는 '납부자 무료 / 미납자 5000원'을
// 그리고 편집 패널은 같은 사실을 유형 하나와 금액 둘로 준다.
test('EVT-02B: 참가비는 고른 유형과 금액 둘로 온다', async ({ page }) => {
  await page.goto(BASICS)

  const fee = page.getByRole('radiogroup', { name: '참가비' })
  await expect(fee.getByRole('radio', { name: '학생회비 조건부' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(fee.getByRole('radio', { name: '무료' })).toHaveAttribute('aria-checked', 'false')

  await fee.getByRole('radio', { name: '정액 유료' }).click()
  await expect(fee.getByRole('radio', { name: '정액 유료' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

// **필수가 하나도 없다.** 같은 와이어프레임의 다른 폼은 필수를 별표로 그렸는데
// 이 패널에는 하나도 없다. 그래서 저장이 막히지 않는다.
test('EVT-02B: 필수 별표가 없고 저장은 막히지 않는다', async ({ page }) => {
  await page.goto(BASICS)

  const panel = page.getByRole('dialog', { name: '행사 기본정보 수정' })
  await expect(panel.getByText('*')).toHaveCount(0)

  await panel.getByRole('textbox', { name: '행사명' }).fill('')
  await panel.getByRole('button', { name: '저장' }).click()
  await expect(page).toHaveURL(/#\/EVT-02\?eventId=E-01/)
})

// '종료 시간 미정'·'장소 미정'이 옆 칸을 잠그는지는 명세가 말하지 않는다
// (input에는 enabledWhen이 없다). 그래서 화면도 잠그지 않는다.
test('EVT-02B: 미정 체크는 옆 칸을 잠그지 않는다', async ({ page }) => {
  await page.goto(BASICS)

  const panel = page.getByRole('dialog', { name: '행사 기본정보 수정' })
  await panel.getByRole('checkbox', { name: '장소 미정' }).check()

  await expect(panel.getByRole('checkbox', { name: '장소 미정' })).toBeChecked()
  await expect(panel.getByRole('textbox', { name: '장소', exact: true })).toBeEnabled()
})

test('EVT-02B: 취소와 닫기는 둘 다 행사 개요로 되돌린다', async ({ page }) => {
  await page.goto(BASICS)

  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click()
  await expect(page).toHaveURL(/#\/EVT-02\?eventId=E-01/)

  await page.goto(BASICS)
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click()
  await expect(page).toHaveURL(/#\/EVT-02\?eventId=E-01/)
})

test('EVT-02B: 인자가 없으면 아무 행사도 고치게 하지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-02B')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-02B', 'eventId'))
  await expect(page.getByRole('textbox', { name: '행사명' })).toHaveCount(0)
})
