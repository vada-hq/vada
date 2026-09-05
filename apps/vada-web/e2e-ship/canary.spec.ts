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

const READY = expected.screens as Record<
  string,
  { ready: boolean; missing: string[]; needs: string[]; shell: boolean }
>

/**
 * **걸을 화면을 손으로 고르지 않는다.**
 *
 * 아홉 장을 손으로 적어 두었었다. 이 파일이 바로 위에서 '손으로 고르면 고르는
 * 사람이 안 보는 화면은 목록도 안 본다'고 적어 놓고 **한 층 위에서 같은 잘못을
 * 하고 있었다** — 글은 훑어서 냈지만 화면은 아홉 장뿐이었다. 그 아홉에 든 것만
 * 배포 모양으로 열려 봤고, 방금 열아홉 장이 새로 섰는데 그중 하나도 안 걸렸다.
 *
 * 이제 기대값이 화면마다 '무엇을 줘야 열리는지'(`needs`)를 함께 낸다. 그것을
 * 채울 수 있으면 걷는다.
 */

/** 카나리가 심어 둔 것. 밖에서 주는 열쇠는 이 표로 채운다. */
const SEED: Record<string, string> = {
  eventId: 'E-A',
  meetingId: 'MTG-A',
  taskId: 'T-A',
  memberId: 'M-A',
}

/**
 * 화면이 스스로 고르는 것. **주소에 싣지 않는다** — 거르개와 갈피는 사람이 화면
 * 안에서 고르고, 아무것도 안 골랐을 때 무엇을 보여줄지는 화면이 안다.
 */
const INSIDE = new Set(['status', 'scope', 'filter', 'tab', 'type', 'page', 'stage', 'setupMode'])

/**
 * 아직 못 걷는 화면과 그 까닭. **비워 두지 않는다** — 빠진 것이 왜 빠졌는지
 * 보이지 않으면 손으로 고르던 때와 같아진다.
 */
const CANT: Record<string, string> = {
  'ONB-01': '로그인 전 화면이라 셸이 없다. 로그인한 카나리로는 이 화면을 재지 못한다',
  'SIGN-IN': '같다',
  'ORG-00': '같다 — 아직 학생회에 안 든 사람이 보는 화면이다',
  'ORG-01': '같다 — 학생회를 만드는 첫 화면이다',
}

/** 이 화면에는 이것이 보여야 한다. 적힌 것만 잰다. */
const SHOWS: Record<string, string> = {
  'EVT-00A': MINE.event,
  'OPS-MEET-01A': MINE.meeting,
  'TASK-01': MINE.task,
  'ORG-07A': MINE.member,
}

/**
 * **오늘 터지는 자리와 그 까닭.**
 *
 * 아홉 장만 걷던 카나리를 쉰아홉 장으로 넓히자 열 장이 터졌다. 하나같이 **아무도
 * 배포 모양으로 열어 본 적 없는 화면**이고, 브라우저 검사 428개는 전부 초록이었다 —
 * 그 검사들은 개발용 응답을 보기 때문이다.
 *
 * **건너뛰지 않고 '터질 것'으로 잰다.** 건너뛰면 고쳐도 아무도 모르고, 새로 터지는
 * 것과 원래 터지던 것이 섞인다. 이렇게 두면 고치는 순간 카나리가 **'터질 줄 알았는데
 * 통과했다'**고 말하고, 그때 이 줄을 지우면 된다.
 *
 * **2026-09-06: 비었다.** 마지막까지 남아 있던 OPS-MEET-02가 회의 진행 방식과 안건
 * 소요 시간을 명세가 들면서 통과했고, 카나리가 먼저 '터질 줄 알았는데 통과했다'고
 * 말해 주었다. 이 표는 비어 있는 것이 맞는 상태다 — 채우는 것은 새로 터졌다는 뜻이다.
 */
const BROKEN: Record<string, string> = {}

const SCREENS = Object.entries(READY)
  .filter(([id, state]) => CANT[id] === undefined && state.needs.every((n) => SEED[n] !== undefined || INSIDE.has(n)))
  .map(([id, state]) => ({
    id,
    params: state.needs
      .filter((n) => SEED[n] !== undefined)
      .map((n, i) => `${i === 0 ? '?' : '&'}${n}=${SEED[n]}`)
      .join(''),
    shows: SHOWS[id],
  }))

// 몇 장을 걷는지 소리 내어 잰다. 줄어들면 눈에 띄어야 한다.
test('걸을 것이 있다', () => {
  expect(SCREENS.length).toBeGreaterThanOrEqual(50)
})

for (const { id, params, shows } of SCREENS) {
  test(`${id}`, async ({ page }) => {
    // 오늘 터지는 자리다. 고치면 이 검사가 '터질 줄 알았는데 통과했다'고 말한다.
    if (BROKEN[id] !== undefined) test.fail(true, BROKEN[id])

    // **브라우저가 한 말을 함께 싣는다.** 화면이 준비 중이라고만 하면 어느 자리가
    // 없어서인지 알 수 없어, 그때부터는 손으로 찾아야 한다.
    const said: string[] = []
    page.on('console', (one) => {
      if (one.type() === 'error') said.push(one.text())
    })
    page.on('pageerror', (one) => said.push(one.message))
    // **무엇을 못 받았는지가 자리를 가리킨다.** '403이 났다'만으로는 어느 자리인지
    // 알 수 없어 손으로 찾아야 한다.
    page.on('response', (one) => {
      if (!one.ok() && new URL(one.url()).pathname.startsWith('/api/')) {
        said.push(`${one.status()} ${new URL(one.url()).pathname}${new URL(one.url()).search}`)
      }
    })
    const 말 = () => (said.length === 0 ? '' : `
  브라우저가 한 말: ${said.join(' | ')}`)

    await page.goto(`/#/${id}${params}`)

    // 화면이 자리 잡을 때까지 기다린다. **기다림 자체로 판정하지 않는다**(`catch`) —
    // 새는 것을 재는 자리가 '살아 있나' 뒤에 있으면, 새면서 죽은 화면이 '안 떴다'
    // 로만 보고된다. 자리를 못 잡으면 아래 판정이 그려진 것을 실어 말한다.
    //
    // '글자가 조금이라도 있으면 됐다'로 기다렸더니 **불러오는 중이라는 글에 걸려
    // 너무 일찍 읽었다**(2026-09-05). 기다릴 것은 글의 길이가 아니라 자리 잡음이다.
    // **준비 중이라는 글이 먼저 온다.**
    //
    // 안 지은 자리를 알리는 글은 셸을 두르는데, 셸도 서버를 읽으므로 그동안은 맨
    // 글로 먼저 그려진다. '준비 중'만 보고 멈추면 **셸이 오기 전에 읽는다** — 그러면
    // 나갈 길이 없다고 잘못 말한다(EVT-02C·02E가 그렇게 붉었다, 2026-09-05).
    //
    // 셸을 두르는 화면은 셸을 기다린다. 안 두르는 화면만 둘 중 하나로 멈춘다.
    const settled = READY[id]?.shell === true
      ? () => (document.body.innerText ?? '').includes('카나리 학생회')
      : () => {
          const text = document.body.innerText ?? ''
          return text.includes('카나리 학생회') || text.includes('아직 준비 중')
        }
    await page.waitForFunction(settled, null, { timeout: 20_000 }).catch(() => {})
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
      expect(drawn, `${id}는 다 지었는데 준비 중이라고 한다${말()}`).not.toContain('아직 준비 중')
      // **셸을 두르는 화면만 셸을 잰다.** 창으로 뜨는 화면과 전체를 차지하는 폼은
      // 애초에 왼쪽 메뉴를 안 두른다 — 그것까지 재면 눈금이 없는 것을 없다고 한다.
      if (state.shell) expect(drawn, `${id}에 셸이 없다${말()}`).toContain(MINE.org)
    } else {
      expect(
        drawn,
        `${id}는 ${state.missing.length}자리를 안 지었는데 그 사실을 말하지 않는다 ` +
          `(모자란 것: ${state.missing.join(' · ')})`,
      ).toContain('아직 준비 중')
      // **갇히지 않는다.** 한동안 준비 중이 화면을 통째로 덮어 왼쪽 메뉴까지
      // 사라졌다 — 사람이 그 화면에서 나갈 단추가 하나도 없었다. 마흔 장이
      // 그 상태였고 이 카나리를 만들다 드러났다(2026-09-05).
      if (state.shell) expect(drawn, `${id}에서 나갈 길이 없다 — 셸이 사라졌다`).toContain(MINE.org)
    }

    // ── 내 것
    if (shows !== undefined) {
      expect(drawn, `내 것이 안 보인다: ${shows}. 그려진 것: ${drawn.slice(0, 220)}`).toContain(shows)
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
