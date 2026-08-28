import { expect, test } from '@playwright/test'
import { pendingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const NEW = '/#/OPS-MEET-02'
const EDIT = '/#/OPS-MEET-02?meetingId=MTG-05'

// OPS-MEET-02는 회의 계열에서 가장 큰 화면이고(절 다섯), 새 어휘 둘이 처음 쓰이는
// 자리다 — 켜고 끄는 칸(input.inputType checkbox)과 여러 줄을 받는 칸(multiline).
//
// 그리고 되풀이되는 묶음이 둘인데 성격이 갈린다: 안건은 사람이 칸을 채우고,
// 참가자는 고르는 것이라 채울 칸이 없다.

test('OPS-MEET-02: 회의 id가 없어도 열린다 — 그것이 새로 만드는 것이다', async ({ page }) => {
  await page.goto(NEW)

  await expect(page.getByRole('heading', { level: 1, name: '새 회의 만들기' })).toBeVisible()
  // 없어도 되는 인자라 화면이 막아서지 않는다.
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: '회의명*' })).toHaveValue('')
  // 그런데 주최자와 회의 상태는 비어 있지 않다 — 서버가 이미 아는 값이다.
  await expect(page.getByRole('textbox', { name: '주최자' })).not.toHaveValue('')
  await expect(page.getByRole('textbox', { name: '회의 상태' })).not.toHaveValue('')
  await page.screenshot({ path: `${SHOTS}/ops-meet-02.png`, fullPage: true })
})

test('OPS-MEET-02: 회의 id가 있으면 그 회의를 읽어 채운다', async ({ page }) => {
  await page.goto(EDIT)

  await expect(page.getByRole('textbox', { name: '회의명*' })).toHaveValue(
    '체육대회 안전 관리 최종 회의',
  )
  await expect(page.getByRole('textbox', { name: '장소*' })).toHaveValue('학생회실 (A204)')
  // 안건 셋이 저마다 다른 값으로 온다. 명세가 적은 것은 그 틀 하나다.
  await expect(page.getByRole('textbox', { name: '안건명*' })).toHaveCount(3)
})

// 사람이 채우지 않는 칸. 비활성이 아니라 애초에 사람이 정하는 값이 아니다.
test('OPS-MEET-02: 주최자와 회의 상태는 보여주되 고칠 수 없다', async ({ page }) => {
  await page.goto(EDIT)

  await expect(page.getByRole('textbox', { name: '주최자' })).toHaveAttribute('readonly', '')
  await expect(page.getByRole('textbox', { name: '회의 상태' })).toHaveAttribute('readonly', '')
  await expect(page.getByText('새 회의는 예정 상태로 생성됩니다.')).toBeVisible()
})

// 새 어휘 하나. 목록에서 고르는 것이 아니라 켜고 끄는 것이다.
test('OPS-MEET-02: 비공개 회의는 켜고 끄는 칸이다', async ({ page }) => {
  await page.goto(EDIT)

  const isPrivate = page.getByRole('checkbox', { name: '비공개 회의' })
  await expect(isPrivate).not.toBeChecked()
  await isPrivate.check()
  await expect(isPrivate).toBeChecked()
})

// 새 어휘 둘. 디자인이 Text Area로 그린 자리는 한 줄짜리가 아니다.
test('OPS-MEET-02: 회의 목적은 여러 줄을 받는 칸이다', async ({ page }) => {
  await page.goto(EDIT)

  const purpose = page.getByRole('textbox', { name: '회의 목적*' })
  await expect(purpose).toHaveJSProperty('tagName', 'TEXTAREA')
  await purpose.fill('행사 전 안전 점검 결과를 공유한다.\n당일 대응 절차를 확정한다.')
  await expect(purpose).toHaveValue(/\n/)
})

test('OPS-MEET-02: 참가자를 넣고 빼면 선택된 수가 따라 바뀐다', async ({ page }) => {
  await page.goto(EDIT)

  await expect(page.getByText('선택됨 4명')).toBeVisible()

  await page.getByRole('searchbox', { name: '이름 또는 부서로 구성원 검색' }).fill('이윤슬')
  await page.getByRole('button', { name: '참가자 추가' }).click()

  await expect(page.getByText('선택됨 5명')).toBeVisible()
  await page.getByRole('button', { name: /이윤슬 참가자에서 빼기/ }).click()
  await expect(page.getByText('선택됨 4명')).toBeVisible()
})

// 안건은 사람이 칸을 채우는 묶음이다. 그래서 빈 안건을 더하면 제출이 막힌다 —
// 되풀이되는 칸이라 판정기가 스스로 답할 수 없고 화면이 답해야 하는 자리다.
test('OPS-MEET-02: 안건을 더하면 그 줄의 필수 칸이 제출을 막는다', async ({ page }) => {
  await page.goto(EDIT)

  await page.getByRole('button', { name: '안건 추가' }).click()
  await expect(page.getByRole('textbox', { name: '안건명*' })).toHaveCount(4)

  await page.getByRole('button', { name: '회의 만들기' }).click()

  await expect(page.getByRole('alert')).toContainText('아직 채우지 않은 칸이 있습니다')
  await expect(page).toHaveURL(/#\/OPS-MEET-02/)
})

test('OPS-MEET-02: 취소하면 어디로 가는지가 아직 없다', async ({ page }) => {
  await page.goto(EDIT)

  await page.getByRole('button', { name: '취소' }).click()

  await expect(page.getByText(pendingNoteOf('OPS-MEET-02', '취소'))).toBeVisible()
})
