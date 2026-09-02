import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// **보내는 화면은 실패를 말해야 한다.**
//
// `useSubmitAction`이 생긴 까닭이 옮겨 적기였다 — 같은 몇 줄을 화면마다 손으로 적었고
// 두 곳은 옳게, 세 곳은 틀리게 적었다. 갈고리를 만들어 옮겨 적을 수 없게 했는데,
// **실패를 그리는 자리는 여전히 화면마다 손으로 적고 있었다.**
//
// 그래서 셋이 새어 있었다(2026-09-02).
//   · ORG-02        카탈로그 문구를 직접 읽어 그렸다 — 갈고리가 고른 글이 안 나온다
//   · OPS-MEET-05A  실패해도 아무 말도 안 한다
//   · OPS-MEET-06B  같음
//
// 마지막 둘이 특히 나쁘다. 보냈는데 실패하면 **화면이 그대로 서 있고** 사람은 눌린 건지
// 아닌지 모른다 — 오늘 배포에서 겪은 '가짜 성공'의 다른 얼굴이다.
//
// **이 검사는 소스 글자를 읽는다.** 약한 방식인 줄 알고 쓴다 — 이름을 바꾸면 헛돈다.
// 다만 '아무도 안 그린다'를 잡을 다른 길이 지금은 없고, 안 잡히면 조용하다.

const here = fileURLToPath(new URL('../screens/', import.meta.url))

function screensThatSubmit(): Array<{ name: string; source: string }> {
  return readdirSync(here)
    .filter((name) => name.endsWith('Screen.tsx'))
    .map((name) => ({ name, source: readFileSync(here + name, 'utf8') }))
    .filter((one) => one.source.includes('useSubmitAction('))
}

describe('보내는 화면은 실패를 말한다', () => {
  it('갈고리가 고른 글을 그린다', () => {
    const silent = screensThatSubmit()
      .filter((one) => !one.source.includes('errorMessage'))
      .map((one) => one.name)
    expect(silent).toEqual([])
  })

  // **카탈로그를 직접 읽으면 갈고리를 지나치게 된다.** '아직 서버에 붙지 않았다'처럼
  // 갈고리만 아는 글이 그때 사라진다.
  it('카탈로그의 실패 문구를 화면이 직접 읽지 않는다', () => {
    const copied = screensThatSubmit()
      .filter((one) => /messages\.error/.test(one.source))
      .map((one) => one.name)
    expect(copied).toEqual([])
  })
})
