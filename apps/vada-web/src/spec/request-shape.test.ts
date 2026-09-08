import { describe, expect, it } from 'vitest'
import bodies from '../../../../specs/figma/vada-wireframe/request-bodies.json'
import { OffContract, checkBody, takesBody } from './request-shape'
import { listsOf, payloadOf } from './draft-values'
import { ALL_SPEC_SCREENS } from './screens'
import type { ListSpec, ScreenSpec } from './types'

// **화면이 보내는 몸통이 계약이 적은 꼴인가.**
//
// 이 자리가 없던 동안 ORG-02가 부서를 `'기획부\n홍보부'`라는 글 하나로 보냈고 서버는
// 계약대로 배열을 요구해 422로 막았다 — **누르면 학생회가 안 만들어졌다.** 배포된 것을
// 사람이 눌러 보고서야 알았다(2026-09-09).
//
// 그때 검사는 초록이었다. 서버 쪽 검사가 있었으나 **손으로 계약의 배열을 적어 넣고**
// 그것을 쟀다 — 화면이 실제로 무엇을 만드는지는 아무도 안 쟀다. 이 저장소가 이미
// 배운 '빈 것에 대고 재면 늘 통과한다'가 다른 옷을 입고 온 것이다.
//
// 여기서 재는 것 셋:
//
// 1. 명세가 든 목록마다, 초안의 평평한 꼴이 계약의 배열로 옮겨지는가
// 2. 그 배열의 줄이 계약이 적은 칸을 갖는가
// 3. **옛 꼴은 막히는가** — 눈금이 터지는 것을 여기서 보인다

const CONTRACT = bodies as Record<string, { properties?: Record<string, { type?: string }> }>

/** 명세에 목록이 있는 화면들. **폴더를 걸어 모은다** — 손으로 적으면 늘 때마다 틀린다. */
const WITH_LISTS: Array<{ screen: ScreenSpec; lists: ListSpec[] }> = ALL_SPEC_SCREENS.map(
  (screen) => ({ screen, lists: listsOf(screen) }),
).filter((one) => one.lists.length > 0)

/** 그 목록이 담을 줄 하나를 초안의 꼴로 짓는다. 사람이 화면에서 만든 것과 같은 모양이다. */
function draftWithRows(spec: ListSpec, rowIds: string[]): Record<string, string> {
  const values: Record<string, string> = { [spec.fieldKey]: rowIds.join('\n') }
  if (spec.itemFields === undefined) return values
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const one of node) walk(one)
      return
    }
    const holder = node as { fieldKey?: unknown }
    if (typeof holder.fieldKey === 'string') {
      for (const rowId of rowIds) values[`${spec.fieldKey}.${rowId}.${holder.fieldKey}`] = '값'
    }
    for (const one of Object.values(node)) walk(one)
  }
  walk(spec.itemFields)
  return values
}

describe('초안이 계약의 꼴로 나간다', () => {
  // **빈 것에 대고 재면 늘 통과한다.** 목록을 가진 화면이 하나도 안 잡히면 아래가
  // 전부 통과하는데, 그것은 아무것도 재지 않았다는 뜻이다.
  it('잴 목록이 있다', () => {
    expect(WITH_LISTS.length).toBeGreaterThan(0)
    expect(WITH_LISTS.flatMap((one) => one.lists).length).toBeGreaterThan(0)
  })

  it.each(WITH_LISTS.flatMap(({ screen, lists }) => lists.map((spec) => ({ screen, spec }))))(
    '$screen.screenId의 $spec.fieldKey가 줄의 배열로 나간다',
    ({ screen, spec }) => {
      const payload = payloadOf(screen, draftWithRows(spec, ['r0', 'r1']))
      const rows = payload[spec.fieldKey]
      expect(Array.isArray(rows)).toBe(true)
      expect(rows as unknown[]).toHaveLength(2)
      for (const row of rows as unknown[]) {
        expect(typeof row).toBe('object')
        expect(Array.isArray(row)).toBe(false)
      }
    },
  )

  // **줄의 속을 명세가 말한다.** 칸이 여럿이면 `itemFields`가, 값 하나뿐이면
  // `itemValueKey`가 든다. 둘 다 없으면 화면과 서버가 각자 이름을 고르게 되고,
  // 부서에서 실제로 그랬다.
  it.each(WITH_LISTS.flatMap(({ screen, lists }) => lists.map((spec) => ({ screen, spec }))))(
    '$screen.screenId의 $spec.fieldKey는 줄의 속을 명세가 안다',
    ({ spec }) => {
      expect(
        spec.itemFields !== undefined || spec.itemValueKey !== undefined,
      ).toBe(true)
    },
  )

  // 값 하나뿐인 줄은 **줄 이름이 곧 값이다.** 부서의 이름, 참가자의 구성원 id.
  it('칸이 없는 목록은 줄 이름을 명세가 정한 이름으로 단다', () => {
    const bare = WITH_LISTS.flatMap(({ screen, lists }) =>
      lists.filter((spec) => spec.itemFields === undefined).map((spec) => ({ screen, spec })),
    )
    expect(bare.length).toBeGreaterThan(0)
    for (const { screen, spec } of bare) {
      const rows = payloadOf(screen, draftWithRows(spec, ['가', '나']))[spec.fieldKey]
      expect(rows).toEqual([
        { [spec.itemValueKey!]: '가' },
        { [spec.itemValueKey!]: '나' },
      ])
    }
  })

  // **묶음이 값을 어떻게 들고 있었는지는 나가지 않는다.** `묶음.줄.칸`도 `묶음.root`도
  // 초안의 사정이지 서버가 받는 것이 아니다.
  it('초안의 부속 열쇠는 몸통에 남지 않는다', () => {
    const org02 = ALL_SPEC_SCREENS.find((screen) => screen.screenId === 'ORG-02')!
    const payload = payloadOf(org02, {
      setupMode: 'basic',
      departments: '기획부\n홍보부',
      'departments.root': '회장단',
    })
    expect(Object.keys(payload)).toEqual(['setupMode', 'departments'])
    expect(payload.departments).toEqual([{ name: '기획부' }, { name: '홍보부' }])
  })
})

describe('계약과 갈린 몸통은 나가지 못한다', () => {
  // **눈금이 터지는 것을 여기서 보인다.** 고쳐 놓고 '통과한다'만 재면, 눈금이 정말
  // 무엇을 잡는지는 아무도 모른 채로 남는다.
  it('부서를 글 하나로 보내면 막힌다 — 2026-09-09에 배포된 것이 이 꼴이었다', () => {
    expect(() =>
      checkBody('org.create', 'POST', '/api/orgs', {
        orgType: 'college',
        departments: '기획부\n홍보부',
      }),
    ).toThrow(OffContract)
  })

  it('막으면서 어느 칸이 무슨 꼴이어야 하는지 말한다', () => {
    try {
      checkBody('org.create', 'POST', '/api/orgs', { departments: '기획부' })
      expect.unreachable('막았어야 합니다')
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(OffContract)
      expect((thrown as OffContract).field).toBe('departments')
      expect((thrown as Error).message).toContain('배열')
    }
  })

  it('줄에 계약이 요구한 칸이 없으면 막힌다', () => {
    expect(() =>
      checkBody('org.create', 'POST', '/api/orgs', { departments: [{ 이름: '기획부' }] }),
    ).toThrow(OffContract)
  })

  it('몸통을 안 받는 계약에 몸통을 보내면 막힌다', () => {
    expect(takesBody('POST', '/api/org/invite')).toBe(false)
    expect(() => checkBody('org.regenerateInvite', 'POST', '/api/org/invite', { a: 1 })).toThrow(
      OffContract,
    )
    expect(() => checkBody('org.regenerateInvite', 'POST', '/api/org/invite', {})).not.toThrow()
  })

  // 화면이 만든 몸통은 그대로 지나가야 한다. 문이 옳은 것까지 막으면 문이 아니라 벽이다.
  it('화면이 만든 몸통은 지나간다', () => {
    const org02 = ALL_SPEC_SCREENS.find((screen) => screen.screenId === 'ORG-02')!
    const payload = payloadOf(org02, {
      orgType: 'college',
      repSchool: 'SCH-HYU-ERICA',
      repCollege: 'COL-HYU-ERICA-SW',
      orgName: '제12대 소프트웨어융합대학 학생회',
      operatingYear: '2026',
      setupMode: 'basic',
      departments: '기획부\n홍보부',
      'departments.root': '회장단',
    })
    expect(() => checkBody('org.create', 'POST', '/api/orgs', payload)).not.toThrow()
  })

  // 계약이 목록이라 적은 자리가 실제로 있어야 이 눈금이 뜻을 갖는다.
  it('계약에 줄의 배열을 받는 자리가 있다', () => {
    const withArrays = Object.entries(CONTRACT).filter(([, schema]) =>
      Object.values(schema.properties ?? {}).some((one) => one.type === 'array'),
    )
    expect(withArrays.length).toBeGreaterThan(0)
  })
})
