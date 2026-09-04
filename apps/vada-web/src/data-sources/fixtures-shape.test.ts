import Ajv from 'ajv'
import { describe, expect, it } from 'vitest'
import openapi from '../../../../specs/figma/vada-wireframe/openapi.json'
import catalogJson from '../../../../specs/figma/vada-wireframe/data-sources.json'
import { readDataSource } from './catalog'

// **개발용 응답도 계약의 모양을 지켜야 한다.**
//
// 서버가 답하는 자리는 계약의 모양대로 답하는지 잰다(`apps/api/src/contract-shape.test.ts`).
// 그런데 화면이 보는 값은 **둘**이다 — 붙은 자리는 서버에서 오고 아직인 자리는
// 개발용 응답에서 온다. 그 둘이 같은 계약을 지키지 않으면, 개발 빌드에서 되던
// 화면이 붙는 순간 다르게 그려진다.
//
// **값이 같은지는 재지 않는다.** 둘은 서로 다른 상황의 진실이다 — 하나는 그림이
// 그린 예시고 하나는 그 학생회의 실제 값이다. 재는 것은 **같은 약속을 지키는가**뿐이다.
// (교차검토가 이 구분을 짚었다, 2026-09-05.)
//
// 이것이 `fixtures.ts` 4,601줄을 걷어내는 일을 대신하지는 않는다. 붙은 자리의 가짜는
// 아직 그대로이고, 그림 대조가 그 값으로 돌기 때문에 그냥 지울 수 없다 — 그 일은
// 백로그의 '지금' 칸에 있다. 여기는 **그때까지 두 진실이 갈리는 것을 재는 자리**다.

const ajv = new Ajv({ strict: false, allErrors: true })

/** 계약이 이름을 대고 개발용 응답이 실제로 든 것을 준다. */
const GIVEN: Record<string, string> = {
  eventId: 'E-01',
  meetingId: 'MTG-01',
  requestId: 'PR-2026-0031',
  taskId: 'T-01',
  itemId: 'ITEM-01',
  roomId: 'ROOM-01',
  memberId: 'M-01',
  status: 'all',
  scope: 'all',
  stage: 'review',
  tab: 'todo',
  filter: 'all',
  type: 'all',
  page: '1',
  setupMode: 'copyBase',
  inviteCode: 'AB12CD34',
}

/**
 * 같은 이름이 자리마다 다른 것을 가리키는 인자.
 *
 * 영수증이 그렇다 — 참석의 영수증과 신청의 영수증은 다른 값이다. 링크도 자리마다
 * 다른 설문을 가리킨다. 이름 하나로 주면 없는 것을 물은 셈이 되어 조용히 건너뛴다.
 */
const INSTEAD: Record<string, Record<string, string>> = {
  'attendance.checkInForm': { checkInToken: 'A7K2M9' },
  'attendance.checkInResult': { receiptToken: 'RCPT-A7K2M9' },
  'survey.applyForm': { surveyToken: 'SVY-4f2a91c7' },
  'survey.applyResult': { receiptToken: 'RCPT-SVY-4f2a91c7' },
  'survey.linkState': { surveyToken: 'SVY-9c15ae40' },
}

interface Seat {
  key: string
  params: Record<string, string>
  schema: object
}

/** 개발용 응답이 답하는 자리와 그 자리의 계약. */
function seats(): Seat[] {
  const paths = openapi.paths as unknown as Record<string, Record<string, never>>
  const byId = new Map<string, object>()
  for (const item of Object.values(paths)) {
    for (const operation of Object.values(item)) {
      const op = operation as unknown as {
        operationId: string
        responses: Record<string, { content?: { 'application/json': { schema: object } } }>
      }
      const schema = op.responses['200']?.content?.['application/json']?.schema
      if (schema !== undefined) byId.set(op.operationId, schema)
    }
  }

  const found: Seat[] = []
  for (const source of (catalogJson as { sources: Array<{ key: string; params?: Array<{ key: string }> }> })
    .sources) {
    const schema = byId.get(source.key)
    if (schema === undefined) continue
    const params: Record<string, string> = {}
    for (const param of source.params ?? []) {
      const value = INSTEAD[source.key]?.[param.key] ?? GIVEN[param.key]
      if (value !== undefined) params[param.key] = value
    }
    found.push({ key: source.key, params, schema })
  }
  return found
}

describe('개발용 응답이 계약의 모양을 지킨다', () => {
  const all = seats()

  it('잴 것이 있다', () => {
    expect(all.length).toBeGreaterThan(100)
  })

  // **던지는 것은 실패다.**
  //
  // 한동안 여기서 던지는 자리를 걸러 내고 나머지만 쟀다. 그랬더니 개발용 응답의
  // 조각 이름을 일부러 바꿔 반증했는데 **그 자리가 목록에서 사라지면서 통과했다**
  // (2026-09-05). 거르는 그물은 자기가 거른 것을 못 본다.
  //
  // 없는 것을 물은 자리만 건너뛴다 — 인자가 가리키는 것이 개발용 응답에 없는
  // 경우이고, 그것은 어긋남이 아니다.
  it.each(all)('$key', ({ key, params, schema }) => {
    let value: unknown
    try {
      value = readDataSource(key, params)
    } catch (thrown) {
      expect.fail(`${key}의 개발용 응답을 읽다 던졌다: ${(thrown as Error).message}`)
    }
    // 없는 것을 물었다. 잴 것이 없다.
    if (typeof value === 'symbol') return

    const validate = ajv.compile(schema)
    expect(validate(value), `${key}\n${JSON.stringify(validate.errors, null, 1)}`).toBe(true)
  })
})
