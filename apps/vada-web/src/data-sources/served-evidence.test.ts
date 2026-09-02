import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SERVED_MUTATIONS } from './served'

// **진짜로 보낸다고 적었으면, 보내 본 적이 있어야 한다.**
//
// `SERVED_MUTATIONS`에 한 줄 올리면 그 순간부터 배포된 앱이 그 자리로 진짜 요청을
// 보낸다. 그런데 그것이 실제로 닿는지는 아무도 재지 않았다 — 목록에 올리는 일과
// 그 길이 되는 일이 따로였다.
//
// 값을 치른 뒤에 알았다. `auth.signInGoogle`을 올려 두었는데 **화면이 서버의 답을
// 버리고 있었고**, 누르면 아무 일도 안 일어났다. 사람이 배포된 화면을 눌러 보고서야
// 알았다(2026-09-02). `organization.verifyInviteCode`도 같은 상태였다.
//
// ## 무엇을 증거로 보는가
//
// **화면이 쓰는 그 함수로 진짜 서버에 보낸 적**이다(`runMutation('<키>'`). 서버를
// 직접 부르는 검사는 그 사이의 코드를 통째로 건너뛰므로 증거가 되지 않는다 —
// 오늘 난 결함이 정확히 그 사이에 있었다.
//
// **이 검사는 소스 글자를 읽는다.** 약한 줄 알고 쓴다 — 함수 이름을 바꾸면 헛돈다.
// 다만 '아무도 보내 본 적 없다'를 잡을 다른 길이 지금은 없고, 안 잡히면 조용하다.

const serverTests = fileURLToPath(new URL('./', import.meta.url))

/** 진짜 서버에 대고 도는 검사들의 글. */
function integrationSource(): string {
  return readdirSync(serverTests)
    .filter((name) => name.endsWith('.server.test.tsx'))
    .map((name) => readFileSync(serverTests + name, 'utf8'))
    .join('\n')
}

describe('진짜로 보내는 자리마다 보내 본 증거가 있다', () => {
  it('목록에 오른 변이는 통합 검사가 그 길로 보낸다', () => {
    const source = integrationSource()
    const unproven = SERVED_MUTATIONS.filter(
      (key) => !source.includes(`runMutation('${key}'`),
    )
    expect(unproven).toEqual([])
  })

  // 증거가 서버를 직접 부르는 것이면 그 사이의 코드가 빠진다. 오늘 난 결함이 거기 있었다.
  it('증거가 화면이 쓰는 길을 지난다', () => {
    const source = integrationSource()
    expect(source).toContain("import { runMutation }")
  })

  it('세어 둔다 — 몇이 증거를 갖는가', () => {
    // eslint-disable-next-line no-console
    console.log(`\n  진짜로 보내는 변이 ${SERVED_MUTATIONS.length}개 · 전부 통합 증거 있음\n`)
    expect(SERVED_MUTATIONS.length).toBeGreaterThan(0)
  })
})
