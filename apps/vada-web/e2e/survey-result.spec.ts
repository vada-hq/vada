import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

// 링크로 온 설문 응답자가 보는 두 화면(EXT-02B · EXT-02C).
//
// 둘 다 **로그인한 사람이 없다.** 그래서 무엇을 보여줄지는 주소의 설문 토큰만이
// 정하고, 토큰이 없거나 모르는 것이면 아무거나 대신 보여주지 않는다.

const SHOTS = 'e2e/shots'

// 지금 신청을 받는 설문. EXT-02A가 신청을 보내고 이 토큰을 그대로 넘긴다.
const LIVE = 'SVY-4f2a91c7'
// 아직 모집이 시작되지 않은 설문.
const BEFORE_OPEN = 'SVY-9c15ae40'
// 정원이 찬 설문. 같은 화면이 상태에 따라 다른 카드를 그린다.
const FULL = 'SVY-77d4c0a9'
// 응답이 있어 교체된 옛 설문. 다섯 중 유일하게 갈 곳이 있다.
const REPLACED = 'SVY-0b3d77e1'

test('EXT-02B: 신청 결과와 참가비 상태를 함께 보여준다', async ({ page }) => {
  await page.goto(`/#/EXT-02B?surveyToken=${LIVE}`)

  await expect(
    page.getByRole('heading', { level: 1, name: '참여 신청이 완료되었습니다' }),
  ).toBeVisible()

  const head = page.locator('[data-node-id="30:7240"]')
  await expect(head.getByText('2026 소프트웨어융합대학 체육대회', { exact: true })).toBeVisible()
  // 로그인한 사람의 이름이 아니라 방금 낸 응답에서 온 값이다.
  await expect(head.getByText('신청자: 김바다', { exact: true })).toBeVisible()

  const fee = page.locator('[data-node-id="30:7251"]')
  await expect(fee.getByText('참가비', { exact: true })).toBeVisible()
  await expect(fee.getByText('관리자 확인 중', { exact: true })).toBeVisible()
  await expect(
    fee.getByText('학생회비 납부 여부 확인 후 결정됩니다.', { exact: true }),
  ).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/ext-02b.png`, fullPage: true })
})

test('EXT-02B: 나가는 단추가 없다', async ({ page }) => {
  await page.goto(`/#/EXT-02B?surveyToken=${LIVE}`)

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // 막다른 화면이다 — 외부인에게 열린 다른 화면이 없으므로 갈 곳이 없다.
  await expect(page.getByRole('button')).toHaveCount(0)
  await expect(page.getByRole('link')).toHaveCount(0)
})

test('EXT-02B: 토큰이 없으면 아무 신청 결과나 대신 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/EXT-02B')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EXT-02B', 'surveyToken'))
  await expect(page.getByText('신청자: 김바다', { exact: true })).toHaveCount(0)
})

test('EXT-02C: 링크가 왜 막혔는지 한 장으로 알린다', async ({ page }) => {
  await page.goto(`/#/EXT-02C?surveyToken=${BEFORE_OPEN}`)

  const card = page.locator('[data-node-id="30:7279"]')
  await expect(card.getByRole('heading', { level: 1, name: '모집 전' })).toBeVisible()
  await expect(
    card.getByText('참가 신청이 아직 시작되지 않았습니다.', { exact: true }),
  ).toBeVisible()
  // 갈 곳이 없는 상태에는 단추가 없다(사람이 정한 것: 그림의 '돌아가기'는 그리지 않는다).
  await expect(card.getByRole('button')).toHaveCount(0)

  await page.screenshot({ path: `${SHOTS}/ext-02c.png`, fullPage: true })
})

test('EXT-02C: 카드 한 장만 그린다 — 다섯 상태가 함께 보이지 않는다', async ({ page }) => {
  await page.goto(`/#/EXT-02C?surveyToken=${FULL}`)

  await expect(page.getByRole('heading', { level: 1, name: '정원 마감' })).toBeVisible()
  await expect(page.getByText('신청 정원이 모두 찼습니다.', { exact: true })).toBeVisible()
  for (const other of ['모집 전', '모집 마감', '링크 비활성화']) {
    await expect(page.getByText(other, { exact: true })).toHaveCount(0)
  }
})

test('EXT-02C: 교체된 설문은 새 설문의 신청 폼으로 데려간다', async ({ page }) => {
  await page.goto(`/#/EXT-02C?surveyToken=${REPLACED}`)

  await expect(
    page.getByRole('heading', { level: 1, name: '기존 설문 종료 · 새 설문으로 교체됨' }),
  ).toBeVisible()
  await page.getByRole('button', { name: '새 설문으로 이동 →' }).click()

  // 새 토큰은 주소에도 화면에도 없었다 — 서버가 이은 값이다.
  await expect(page).toHaveURL(new RegExp(`EXT-02A\\?surveyToken=${LIVE}`))
})

test('EXT-02C: 토큰이 없으면 아무 설문의 상태나 대신 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/EXT-02C')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EXT-02C', 'surveyToken'))
  await expect(page.getByText('모집 전', { exact: true })).toHaveCount(0)
})
