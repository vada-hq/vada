import { expect, test } from '@playwright/test'
import { missingNoteOf, pendingNoteAt, successNoteAt } from './spec'

const SHOTS = 'e2e/shots'
const SURVEY = '/#/EVT-05?eventId=E-01'
const REPLACE = '/#/EVT-05B?eventId=E-01'

// 행사 갈래의 마지막 둘(EVT-05 · EVT-05B).
//
// 둘 다 인원 관리 갈피 아래로 한 겹 더 들어간 화면이고 겹쳐 뜨지 않는다 - 제
// 셸을 그린다. EVT-05B는 카드 한 장이지만 뒤에 아무것도 남지 않는다(모달이 아니다).

// ── EVT-05 · 참여 설문 생성·관리 ────────────────────────────────────────────

// 활성화 조건은 **묶음으로 온다.** 행사 기본정보에서 채울 것과 참여 설문에서 채울
// 것이 갈리고, 못 채운 것이 몇인지는 서버가 센다.
test('EVT-05: 활성화 조건은 묶음으로 오고 못 채운 수는 서버가 센다', async ({ page }) => {
  await page.goto(SURVEY)

  const card = page.locator('[data-node-id="25:700"]')
  await expect(card).toContainText('설문 링크 활성화 조건')
  await expect(card).toContainText('행사 기본정보')
  await expect(card).toContainText('참여 설문 설정')

  // 못 채운 수는 두 자리에 그려진다 - 조건 카드의 딱지와 단추의 배지.
  await expect(page.locator('[data-node-id="25:704"]')).toHaveText('미충족 2개')
  await expect(page.locator('[data-node-id="25:525"]')).toHaveText('2')

  // 채워진 줄과 못 채운 줄. 못 채운 줄만 무엇이 모자란지와 어디서 채우는지를 갖는다.
  await expect(card).toContainText('납부자·미납자 금액·결제 안내')
  await expect(card).toContainText('금액과 결제 안내를 입력하세요')
  await expect(card).toContainText('입력 위치: 행사 기본정보 → 참가비(학생회비 조건부)')

  await page.screenshot({ path: `${SHOTS}/evt-05.png`, fullPage: true })
})

// **막는 것은 서버다.** 무엇이 모자란지는 조직의 규칙이라 화면이 셀 수 없고,
// 화면이 하는 일은 서버가 준 까닭을 그대로 내놓는 것뿐이다(sourceAllows).
test('EVT-05: 조건을 못 채우면 활성화는 서버가 준 까닭만 내놓는다', async ({ page }) => {
  await page.goto(SURVEY)

  await page.getByRole('button', { name: '설문 링크 활성화' }).click()

  await expect(page.getByRole('alert')).toContainText('활성화 조건')
  // 막혔으므로 보내지 않는다 - 상태 딱지도 그대로다.
  await expect(page).toHaveURL(/#\/EVT-05\?eventId=E-01/)
  await expect(page.locator('[data-node-id="25:515"]')).toHaveText('초안')
})

// 줄마다 가는 곳이 다르다. **데이터는 열쇠만 주고 갈 곳은 명세가 든다** -
// 기본정보에서 채울 것은 EVT-02B로, 모집 설정에서 채울 것은 이 화면으로 간다.
test('EVT-05: 조건 줄의 채우러 가기는 명세가 든 갈래로 데려간다', async ({ page }) => {
  await page.goto(SURVEY)

  await page.getByRole('button', { name: '기본정보에서 수정 →' }).click()
  await expect(page).toHaveURL(/#\/EVT-02B\?eventId=E-01/)

  await page.goto(SURVEY)
  await page.getByRole('button', { name: '모집 설정에서 입력 →' }).click()
  await expect(page).toHaveURL(/#\/EVT-05\?eventId=E-01/)
})

// 모집 설정의 초안은 서버에서 읽어 온다(draftFrom). 고른 값도 켠 칸도 그대로 온다.
test('EVT-05: 모집 설정은 읽어 온 값으로 시작한다', async ({ page }) => {
  await page.goto(SURVEY)

  await expect(page.getByRole('radio', { name: '선착순' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByRole('checkbox', { name: '학생회비 납부 여부 대조' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: '정원 초과 시 대기 신청 운영' })).not.toBeChecked()

  // 마감 일시가 비어 있고, 그것이 링크를 못 켜는 까닭 중 하나다(helperText).
  await expect(page.getByLabel('신청 마감 일시')).toHaveValue('')
  await expect(
    page.getByText('신청 마감 일시를 입력해야 링크를 활성화할 수 있습니다'),
  ).toBeVisible()
})

// 응답이 있는 문항은 잠긴다. 잠긴 문항에는 지우는 자리가 아예 그려지지 않는다.
test('EVT-05: 잠긴 문항에는 지우는 자리가 없다', async ({ page }) => {
  await page.goto(SURVEY)

  const questions = page.locator('[data-node-id="25:844"]')
  await expect(questions).toContainText('이름')
  await expect(questions).toContainText('필수 · 삭제 불가')

  await expect(page.getByRole('button', { name: '이름 문항 삭제' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '단과대학 문항 삭제' })).toHaveCount(1)
})

// 아직 정해지지 않은 것은 정해지지 않았다고 말한다. 그 글은 명세가 갖는다.
test('EVT-05: 미리보기와 행사 시작은 아직 정해지지 않았다고 말한다', async ({ page }) => {
  await page.goto(SURVEY)

  await page.getByRole('button', { name: '미리보기' }).click()
  await expect(page.getByRole('alert')).toContainText(pendingNoteAt('EVT-05', '25:517'))

  await page.getByRole('button', { name: '행사 시작' }).click()
  await expect(page.getByRole('alert')).toContainText(pendingNoteAt('EVT-05', '25:572'))
})

test('EVT-05: 인자가 없으면 아무 행사의 설문도 보여주지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-05')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-05', 'eventId'))
  await expect(page.getByText('설문 링크 활성화 조건')).toHaveCount(0)
})

// ── EVT-05B · 설문 교체 ─────────────────────────────────────────────────────

// **응답이 있는 설문은 직접 고칠 수 없다.** 그 사실과 몇 명이 다시 응답해야 하는지를
// 서버가 세어 준다.
test('EVT-05B: 교체의 여파는 서버가 세어 준다', async ({ page }) => {
  await page.goto(REPLACE)

  await expect(page.getByRole('heading', { name: '새 설문으로 교체하시겠어요?' })).toBeVisible()
  await expect(page.getByText('응답이 존재하는 설문은 직접 수정할 수 없습니다.')).toBeVisible()

  const impact = page.locator('[data-node-id="25:1132"]')
  await expect(impact).toContainText('현재 설문 응답자')
  await expect(impact).toContainText('142명')
  await expect(impact).toContainText('영향받는 응답자')
  await expect(impact).toContainText('142명 (재응답 필요)')

  await page.screenshot({ path: `${SHOTS}/evt-05b.png`, fullPage: true })
})

// 새 설문을 어떻게 시작할지는 명세가 처음 값을 정해 두었다(select.initialValue).
test('EVT-05B: 새 설문 시작 방식은 기존 질문 복사로 시작한다', async ({ page }) => {
  await page.goto(REPLACE)

  await expect(page.getByRole('radio', { name: /기존 질문 복사해서 시작/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByRole('radio', { name: /빈 설문으로 시작/ })).toHaveAttribute(
    'aria-checked',
    'false',
  )

  await page.getByRole('radio', { name: /빈 설문으로 시작/ }).click()
  await expect(page.getByRole('radio', { name: /빈 설문으로 시작/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

// 취소는 **떠나면서 초안을 끝낸다**(action.scopeEvent). 되돌아가는 곳은 참여 설문이다.
test('EVT-05B: 취소는 참여 설문으로 되돌린다', async ({ page }) => {
  await page.goto(REPLACE)

  await page.getByRole('button', { name: '취소' }).click()
  await expect(page).toHaveURL(/#\/EVT-05\?eventId=E-01/)
})

// 보내고 나면 어디로 가는지가 아직 정해지지 않았다고 명세가 적어 두었다. 적어만
// 두고 아무도 안 보여주면 사람은 아무 일도 안 일어나는 것을 본다.
test('EVT-05B: 교체를 보내면 그 뒤가 아직 정해지지 않았다고 말한다', async ({ page }) => {
  await page.goto(REPLACE)

  await page.getByRole('button', { name: '기존 설문 종료 후 새 설문 초안 만들기' }).click()

  await expect(page.getByRole('status')).toHaveText(successNoteAt('EVT-05B', '25:1184'))
  await expect(page).toHaveURL(/#\/EVT-05B\?eventId=E-01/)
})

test('EVT-05B: 인자가 없으면 무엇을 교체할지 묻지 않는다', async ({ page }) => {
  await page.goto('/#/EVT-05B')

  await expect(page.getByRole('alert')).toContainText(missingNoteOf('EVT-05B', 'eventId'))
  await expect(page.getByText('새 설문으로 교체하시겠어요?')).toHaveCount(0)
})
