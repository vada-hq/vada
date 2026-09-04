import { expect, test } from '@playwright/test'
import expected from './canary-expect.json' with { type: 'json' }

// **나가는 묶음을 사람이 여는 그대로 걷는다.**
//
// 브라우저 검사 428개는 개발용 응답으로 만든 `dist-e2e/`를 본다 — 명세가 말한 것을
// 화면이 그리는가를 재는 자리이고, 그 짝은 옳다. 그런데 **실제로 배포되는 `dist/`는
// 아무도 브라우저로 안 열어 봤다.**
//
// 2026-09-05에 값을 치렀다. 방금 만든 빈 학생회의 홈에 남의 행사와 남의 예산이
// 그려졌는데 428개 중 하나도 못 잡았고 **사람이 눌러 보고 찾았다.**
//
// 여기가 그 자리다. 재는 것은 넷이다.
//
// 1. **내 것이 보인다** — 진짜 저장소에서 온 값이 그려진다
// 2. **남의 것이 한 글자도 없다** — 학생회 둘을 심어 두고 하나로 로그인해 걷는다
// 3. **안 지은 자리를 읽는 화면은 준비 중이라고 말한다** — 어제 홈이 그러지 않고
//    가짜를 그렸다. 이것이 그 결함을 정확히 짚는 자리다
// 4. **쓴 것이 새로고침 뒤에도 남는다**
//
// 기대값은 손으로 안 적는다(`scripts/canary-expect.mjs`가 훑는다) — 손으로 고르면
// 고르는 사람이 안 보는 화면은 목록도 안 본다. 그것을 한 번 겪었다.

/** 카나리 학생회의 것. 화면에 보여야 한다. */
const MINE = {
  org: '카나리 학생회',
  event: '카나리 봄 축제',
  meeting: '카나리 정기회의',
  task: '카나리 포스터 시안',
  member: '카나리김',
}

/**
 * 옆집 학생회의 것. **한 글자도 보이면 안 된다.**
 *
 * 내 것과 같은 모양으로 지었다 — 남의 것만 이상한 말이면 그것이 안 보이는 게
 * 울타리 덕인지 그냥 그런 말이 없어서인지 갈리지 않는다.
 */
const THEIRS = ['옆집 학생회', '옆집 봄 축제', '옆집 정기회의', '옆집 포스터 시안', '옆집김']

const READY = expected.screens as Record<string, { ready: boolean; missing: string[] }>

/** 영역마다 하나씩. 인자가 필요한 것은 카나리가 심어 둔 것을 가리킨다. */
const SCREENS = [
  { id: 'HOME-01K', what: '홈' },
  { id: 'EVT-00A', what: '행사 목록', shows: MINE.event },
  { id: 'OPS-MEET-01A', what: '회의 목록', shows: MINE.meeting },
  { id: 'TASK-01', what: '상시 업무 보드', shows: MINE.task },
  { id: 'ORG-07A', what: '학생 명단', shows: MINE.member },
  { id: 'ORG-04', what: '역할과 권한' },
  { id: 'ORG-03A', what: '조직도' },
  { id: 'EVT-02', params: '?eventId=E-A', what: '행사 개요' },
  { id: 'OPS-MEET-03A', params: '?meetingId=MTG-A', what: '회의 상세' },
]

for (const { id, params = '', what, shows } of SCREENS) {
  test(`${what}(${id})`, async ({ page }) => {
    await page.goto(`/#/${id}${params}`)

    // 화면이 자리 잡을 때까지 기다린다. **기다림 자체로 판정하지 않는다**(`catch`) —
    // 새는 것을 재는 자리가 '살아 있나' 뒤에 있으면, 새면서 죽은 화면이 '안 떴다'
    // 로만 보고된다. 자리를 못 잡으면 아래 판정이 그려진 것을 실어 말한다.
    //
    // '글자가 조금이라도 있으면 됐다'로 기다렸더니 **불러오는 중이라는 글에 걸려
    // 너무 일찍 읽었다**(2026-09-05). 기다릴 것은 글의 길이가 아니라 자리 잡음이다.
    await page
      .waitForFunction(
        () => {
          const text = document.body.innerText ?? ''
          return text.includes('카나리 학생회') || text.includes('아직 준비 중')
        },
        null,
        { timeout: 20_000 },
      )
      .catch(() => {})
    const drawn = (await page.locator('body').innerText()).replace(/\s+/g, ' ')

    // ── 남의 것
    for (const word of THEIRS) {
      expect(drawn, `남의 학생회 것이 보인다: ${word}`).not.toContain(word)
    }

    // ── 개발용 응답
    for (const word of expected.words) {
      expect(drawn, `개발용 응답이 새어 나왔다: ${word}`).not.toContain(word)
    }

    // ── 다 안 지었으면 그렇게 말해야 한다
    //
    // **이것이 어제 그 결함을 짚는 자리다.** 홈은 일곱을 아직 안 지었는데 가짜로
    // 채워 그렸다. 안 지었으면 안 지었다고 해야 한다.
    const state = READY[id]
    expect(state, `${id}의 기대값이 없다`).toBeDefined()
    if (state.ready) {
      expect(drawn, `${id}는 다 지었는데 준비 중이라고 한다`).not.toContain('아직 준비 중')
      expect(drawn, `${id}에 셸이 없다`).toContain(MINE.org)
    } else {
      expect(
        drawn,
        `${id}는 ${state.missing.length}자리를 안 지었는데 그 사실을 말하지 않는다 ` +
          `(모자란 것: ${state.missing.join(' · ')})`,
      ).toContain('아직 준비 중')
    }

    // ── 내 것
    if (shows !== undefined) {
      expect(drawn, `내 것이 안 보인다: ${shows}`).toContain(shows)
    }
  })
}

// **쓴 것이 남는가.** 화면이 그리는 것과 저장소에 남는 것은 다른 일이다 —
// 한동안 쓰기가 아무 데도 안 가면서 성공을 돌려주고 있었다.
test('쓴 것이 새로고침 뒤에도 남는다', async ({ page }) => {
  await page.goto('/#/EVT-00B')
  await expect(page.getByText(MINE.org).first()).toBeVisible({ timeout: 15_000 })

  const 이름 = `카나리 가을 축제 ${Date.now()}`
  await page.getByRole('textbox').first().fill(이름)
  await page.getByRole('button', { name: /만들기|저장|추가/ }).last().click()

  // 목록으로 가서 새로고침한다. 그릇에 담긴 것이 아니라 저장소에 남은 것을 본다.
  await page.goto('/#/EVT-00A')
  await page.reload()
  await expect(page.getByText(이름)).toBeVisible({ timeout: 15_000 })
})
