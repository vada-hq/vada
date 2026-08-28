import { expect, test } from '@playwright/test'
import { missingNoteOf } from './spec'

const SHOTS = 'e2e/shots'
const TOKEN = 'SVY-4f2a91c7'
const APPLY = `/#/EXT-02A?surveyToken=${TOKEN}`

// 참여 신청 폼(EXT-02A). **링크로 온 사람이 보는 화면이고 로그인한 사람이 없다.**
//
// 그래서 여기서 지키는 것은 안쪽 화면들과 다르다 — 셸이 없어야 하고, 주소가 실어
// 온 것이 행사가 아니라 설문의 토큰이어야 하며, 그 토큰 말고는 무엇의 폼인지 알
// 방법이 없어야 한다.

test('EXT-02A: 학생회 밖에서 보는 화면이라 셸을 그리지 않는다', async ({ page }) => {
  await page.goto(APPLY)

  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toHaveCount(0)

  // 머리의 글은 shell.json의 brand.name이다. 화면이 적으면 두 벌이 된다.
  await expect(page.getByText('Vada', { exact: true })).toBeVisible()

  await page.screenshot({ path: `${SHOTS}/ext-02a.png`, fullPage: true })
})

// **주소가 실어 오는 것은 설문의 토큰이다.** 설문은 갈아 끼울 수 있으므로 링크가
// 가리키는 것은 설문이지 행사가 아니고, eventId를 인자로 두면 아무나 남의 행사의
// 신청 폼을 연다. 그래서 eventId로는 아무것도 열리지 않아야 한다.
test('EXT-02A: 토큰이 없으면 아무 설문도 대신 열지 않는다', async ({ page }) => {
  await page.goto('/#/EXT-02A?eventId=E-01')

  await expect(page.getByRole('alert')).toContainText(
    missingNoteOf('EXT-02A', 'surveyToken'),
  )
  // 무엇의 폼인지 모르면 칸도 없다. 헛되이 입력하게 하지 않는다.
  await expect(page.getByRole('textbox', { name: '이름*' })).toHaveCount(0)
})

// 머리 넉 줄은 전부 그 설문이 정한다 — 화면이 지어내는 글이 하나도 없다.
test('EXT-02A: 행사 정보는 토큰이 가리키는 설문에서 온다', async ({ page }) => {
  await page.goto(APPLY)

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '2026 소프트웨어융합대학 체육대회',
  )
  await expect(page.locator('[data-node-id="30:7147"]')).toContainText('ERICA 체육관')
  await expect(page.locator('[data-node-id="30:7147"]')).toContainText(
    '소프트웨어융합대학 전체',
  )
  // 참가비는 조건까지 문장으로 온다 — 무엇이 무료인지 화면이 유도할 수 없다.
  await expect(page.locator('[data-node-id="30:7173"]')).toHaveText(
    '참가비 납부자 무료 / 미납자 5000원',
  )
})

// 필수를 비운 채로 누르면 보내지 않고, 첫 누락 칸을 짚어 준다.
test('EXT-02A: 빈 폼으로 누르면 보내지 않는다', async ({ page }) => {
  await page.goto(APPLY)

  await page.getByRole('button', { name: '참여 신청하기' }).click()

  await expect(page.getByText('필수 항목입니다').first()).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`#/EXT-02A\\?surveyToken=${TOKEN}`))
})

// **개인정보 수집 동의는 체크해야 보내진다.**
//
// 이 자리는 지금 어휘의 한계가 그대로 드러나는 곳이다. input.required는 '이 칸에
// 값이 있는가'만 묻고 계약은 boolean false도 값으로 못 박아 두었다. 여기서 실제로
// 막히는 것은 이 저장소의 모든 체크 칸이 꺼짐을 null로 담기 때문이다 — 명세가
// '반드시 참이어야 한다'고 말해서가 아니다. 그 사실이 이 검사에 걸려 있어야
// 어휘가 생기는 날 무엇이 달라지는지 알 수 있다.
test('EXT-02A: 동의를 안 하면 보내지 않는다', async ({ page }) => {
  await page.goto(APPLY)

  await page.getByRole('textbox', { name: '이름*' }).fill('김바다')
  await page.getByRole('textbox', { name: '학번*' }).fill('2022123456')
  await pickOption(page, '단과대학*', '소프트웨어융합대학')
  await pickOption(page, '학부·학과*', '컴퓨터학부')
  await pickOption(page, '학년*', '3학년')

  await page.getByRole('button', { name: '참여 신청하기' }).click()

  await expect(page.getByRole('checkbox', { name: '동의합니다' })).not.toBeChecked()
  await expect(page).toHaveURL(new RegExp(`#/EXT-02A\\?surveyToken=${TOKEN}`))

  // 켜면 보내지고 신청 완료로 간다. 토큰은 그대로 따라간다.
  await page.getByRole('checkbox', { name: '동의합니다' }).check()
  await page.getByRole('button', { name: '참여 신청하기' }).click()
  await expect(page).toHaveURL(new RegExp(`#/EXT-02B\\?surveyToken=${TOKEN}`))
})

// 학부·학과의 선택지는 고른 단과대학이 좁힌다. 학교 칸이 없으므로 학교의 자리를
// 토큰이 대신한다(education.departments를 재사용할 수 없는 까닭이다).
test('EXT-02A: 학부·학과는 고른 단과대학이 좁힌다', async ({ page }) => {
  await page.goto(APPLY)

  await pickOption(page, '단과대학*', '소프트웨어융합대학')
  await pickOption(page, '학부·학과*', '컴퓨터학부')

  // 단과대학을 바꾸면 앞서 고른 학부·학과는 남아 있을 수 없다.
  await pickOption(page, '단과대학*', '공학대학')
  await expect(page.getByRole('combobox', { name: '학부·학과*' })).not.toContainText(
    '컴퓨터학부',
  )
})

async function pickOption(
  page: import('@playwright/test').Page,
  field: string,
  option: string,
) {
  await page.getByRole('combobox', { name: field }).click()
  await page.getByRole('option', { name: option }).click()
}
