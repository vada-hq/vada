import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { HANDLERS } from './handlers/index.ts'

// **로그인하고 돌아왔을 때 어디부터인가.**
//
// 그 답은 신원에 따라 갈린다 — 아직 로그인 안 했으면 로그인 화면, 로그인은 했는데
// 어느 학생회에도 없으면 소속 입력, 있으면 집. 그것을 아는 것은 서버뿐이라
// `app.start`가 답한다.
//
// ## 무엇이 터졌나
//
// 제공자에게 넘기는 '돌아올 자리'에 화면이 박혀 있었다(`/#/ONB-01`). 그러면 돌아온
// 브라우저의 주소에 해시가 **이미 채워져** 있고, 앱은 주소가 있는 자리를 존중하므로
// (화면의 주소로 여는 성질이 이 저장소의 규칙이다) **`app.start`를 부를 일이 없다.**
//
// 그래서 `app.start`를 만들어 놓고도 로그인 직후에는 한 번도 안 불렸다. 이미 소속이
// 있는 사람이 로그인하면 소속 입력 화면으로 갔다 — 사람이 두 번 겪고 두 번 말했다
// (2026-09-08, 2026-09-09).
//
// **어디부터인지를 두 곳이 정하면, 아무것도 모르는 쪽이 이긴다.** 상수는 누가 돌아올지
// 모르는 채로 답을 적어 두고, 아는 쪽은 물어보지도 않게 된다.
//
// ## 왜 글자로 재는가
//
// `serve.ts`는 불러오는 순간 서버를 연다. 검사가 들여올 수 없으므로 파일을 글로 읽어
// 견준다 — `serve-lookups.test.ts`가 같은 까닭으로 같은 일을 한다.

const SERVE = readFileSync(fileURLToPath(new URL('./serve.ts', import.meta.url)), 'utf8')

describe('돌아올 자리가 화면을 정하지 않는다', () => {
  it('제공자에게 넘기는 주소에 화면이 박혀 있지 않다', () => {
    const line = SERVE.split('\n').find((one) => one.includes('callbackURL'))
    expect(line, 'serve.ts에 callbackURL을 넘기는 자리가 없습니다').toBeDefined()
    // 해시가 붙으면 그 자리가 곧 화면이다. 화면 id를 적었는지까지 볼 것 없이,
    // **해시 자체가 이 규칙을 깨는 표시**다.
    expect(line, '돌아올 자리에 해시를 붙이면 app.start가 불리지 않습니다').not.toContain('#')
  })

  // **묻는 자리가 실제로 있어야 이 규칙이 뜻을 갖는다.** 계약에서 사라지면 위 검사는
  // 통과하는데 앱은 갈 곳을 잃는다 — 빈 것에 대고 재는 꼴이다.
  it('어디부터인지 답하는 자리가 계약에 있다', () => {
    expect(Object.keys(HANDLERS)).toContain('app.start')
  })
})
