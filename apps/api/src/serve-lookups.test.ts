import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { HANDLERS } from './handlers/index.ts'

// **붙이는 자리와 여는 자리가 다른 파일이라 생기는 구멍.**
//
// 조건부 권한 넷은 저장소를 봐야 답이 나온다(그 회의의 진행 권한자인가, 그 행사의
// 운영진인가). 표가 없던 동안 `serve.ts`가 넷 다 `async () => false`를 주었고 그것은
// 맞는 답이었다 — 없는 것을 있다고 하면 조건부 권한이 전부 열린다.
//
// 그런데 표가 생기고 그 표에 줄을 넣는 자리까지 붙인 뒤에도 그대로면 **거짓이 거짓말이
// 된다.** 배포된 서버에서 회의 시작·종료·안건 넘기기가 전부 403이고, 화면은 그 단추를
// 회색으로 그린다 — **검사는 전부 초록인 채로.** 검사가 쓰는 딸림은 진짜를 주고
// 배포가 쓰는 딸림만 거짓을 주기 때문이다(2026-09-04에 실제로 그랬다).
//
// ## 무엇을 방아쇠로 삼는가
//
// **그 표에 줄이 들어가는 자리를 답하기 시작했는가.** 줄이 하나도 안 들어가는 표를
// 두고 '없다'고 답하는 것은 참이다 — 막을 것이 아니다. 줄이 들어가기 시작하면
// 그때부터 '없다'가 거짓이 된다.

const SERVE = readFileSync(fileURLToPath(new URL('./serve.ts', import.meta.url)), 'utf8')

interface Guard {
  /** `permissions.ts`가 묻는 이름. */
  lookup: string
  /** 그 표에 줄을 넣는 자리들. 하나라도 답하기 시작하면 거짓은 거짓말이 된다. */
  filledBy: readonly string[]
  why: string
}

const GUARDS: readonly Guard[] = [
  {
    lookup: 'isMeetingHost',
    filledBy: ['meeting.create', 'meeting.saveDraft', 'meeting.grantHostRole'],
    why: '회의를 만들면 만든 사람이 곧 진행 권한자다(ORG-04의 글).',
  },
  {
    lookup: 'isMeetingCreator',
    filledBy: ['meeting.create', 'meeting.saveDraft'],
    why: '회의를 만들면 만든 사람이 생긴다.',
  },
  {
    lookup: 'isEventStaff',
    filledBy: ['event.staff.setup', 'event.staff.save'],
    why: '행사 운영 조직을 세우면 그 조직원이 생긴다.',
  },
  {
    lookup: 'isEventStaffManager',
    filledBy: ['event.staff.setup', 'event.staff.save'],
    why: '같은 자리에서 관리자도 생긴다.',
  },
]

/** 배포가 쓰는 딸림이 이 물음에 **박아 둔 거짓**을 주는가. */
function hardcodedFalse(lookup: string, source: string = SERVE): boolean {
  return new RegExp(lookup + String.raw`\s*:\s*async\s*\(\)\s*=>\s*false`).test(source)
}

describe('표에 줄이 들어가기 시작하면 배포도 그 표를 읽는다', () => {
  it('잴 것이 있다 — 배포가 쓰는 딸림을 읽었다', () => {
    expect(SERVE).toContain('lookups:')
    expect(GUARDS.length).toBeGreaterThan(0)
  })

  it.each(GUARDS)('$lookup', ({ lookup, filledBy, why }) => {
    const filling = filledBy.filter((operationId) => operationId in HANDLERS)
    if (filling.length === 0) {
      // 아직 줄이 안 들어간다. '없다'가 참이므로 막지 않는다.
      expect(filling).toEqual([])
      return
    }
    expect(
      hardcodedFalse(lookup),
      `${lookup}이 serve.ts에서 거짓으로 박혀 있는데 ${filling.join(' · ')}가 이미 답합니다. ${why} ` +
        '배포된 서버에서만 막히고 검사는 초록입니다.',
    ).toBe(false)
  })

  // 규칙이 살아 있는지 반증한다. 박아 둔 거짓을 못 알아보면 이 검사는 늘 통과한다.
  //
  // 한동안 진짜 `serve.ts`의 `isEventStaff`를 반증의 본보기로 썼다 — 2026-09-05에 그
  // 거짓이 표로 바뀌면서 본보기가 사라졌다. 반증은 본보기가 있어야 하므로 글로 심는다.
  it('박아 둔 거짓을 알아본다', () => {
    const planted = 'lookups: {' + String.fromCharCode(10) + '  isEventStaff: async () => false,' + String.fromCharCode(10) + '}'
    expect(hardcodedFalse('isEventStaff', planted)).toBe(true)
    expect(hardcodedFalse('isEventStaff', 'lookups: { ...eventStaffLookups(db) }')).toBe(false)
    expect(hardcodedFalse('있을 리 없는 물음')).toBe(false)
  })

  // 넷 다 표가 답한다 — 배포에 박아 둔 거짓이 하나도 남아 있지 않다.
  it('배포에 박아 둔 거짓이 없다', () => {
    for (const { lookup } of GUARDS) expect(hardcodedFalse(lookup), lookup).toBe(false)
  })
})
