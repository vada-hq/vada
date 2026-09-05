import Ajv from 'ajv'
import openapi from '../../../../specs/figma/vada-wireframe/openapi.json' with { type: 'json' }
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import type { Role, Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'
import { routeOf } from '../routes.ts'

// 행사 쪽 검사 다섯이 함께 쓰는 발판.
//
// **같은 마흔 줄을 다섯 번 적지 않는다.** 앞선 검사들이 저마다 `Deps`를 손으로
// 세웠는데, 자리를 하나 더할 때마다 그 다섯 벌을 함께 고쳐야 하고 한 벌은 늘
// 늦게 고쳐진다. 여기 하나만 두면 고칠 자리가 하나다.
//
// **여기 있는 것은 검사만 쓴다.** 앱은 `serve.ts`가 세운 진짜 `Deps`로 돈다.

/** 검사가 못 박는 지금. 시간대에 기대는 글이 있으므로 늘 함께 온다. */
export const NOW = new Date('2026-08-15T10:00:00+09:00')

export function viewer(role: Role = 'chair'): Viewer {
  return {
    userId: 'U-01',
    membership: {
      orgId: 'ORG-01',
      memberId: 'M-01',
      role,
      departmentId: 'D-01',
      inFinanceDepartment: false,
    },
  }
}

export interface HarnessOptions {
  who?: Viewer | null
  now?: Date
  /** 새로 만드는 것의 이름표. 부를 때마다 다른 것을 준다. */
  newId?: () => string
}

/**
 * 진짜 저장소에 대고 도는 앱.
 *
 * **행사 운영 조직을 아는 자리는 없다고 답한다.** 그 표를 읽는 판정기를 여기서
 * 지어내면 조건부 권한이 검사에서만 열리고, 열린 채로 통과한 자리는 배포된
 * 서버에서 막힌다 — 앞선 검사들이 같은 까닭으로 같은 답을 준다.
 */
export function harness(db: Db, options: HarnessOptions = {}) {
  let made = 0
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => (options.who === undefined ? viewer() : options.who),
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
    },
    // 검사는 밖으로 나가지 않는다. 열려 있다고만 답하고, 부르면 어디로 갈지 말해 준다.
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: {
      linkBase: 'https://vada.app/join',
      now: () => options.now ?? NOW,
      newCode: () => 'CODE',
    },
    newId: options.newId ?? (() => `X-${(made += 1)}`),
  }
  return createApp(deps)
}

/**
 * 그 자리의 답이 **계약이 말한 모양인가.**
 *
 * 모양을 손으로 견주면 계약이 바뀔 때 검사가 따라오지 않는다 — 계약의 스키마를
 * 그대로 컴파일해 재는 것이 이 저장소가 앞서 쓴 방식이고, 여기서도 같다.
 */
export function matchesContract(operationId: string, body: unknown): true | string {
  const at = routeOf(operationId)
  if (at === undefined) return `계약에 '${operationId}'라는 자리가 없습니다.`
  const paths = openapi.paths as unknown as Record<string, Record<string, unknown>>
  const operation = paths[at.path]![at.method] as {
    responses: { 200: { content: { 'application/json': { schema: object } } } }
  }
  const validate = new Ajv({ strict: false }).compile(
    operation.responses[200].content['application/json'].schema,
  )
  return validate(body) ? true : JSON.stringify(validate.errors)
}
