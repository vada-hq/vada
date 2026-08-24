import { describe, expect, it } from 'vitest'
import { resolveParams } from './params'
import { asScreenSpec, drawnTitleOf, evtTask01, onb01, task01 } from './screens'

describe('asScreenSpec', () => {
  it('형태가 깨진 화면 JSON은 명확히 거부한다 (F5)', () => {
    expect(() => asScreenSpec({ schemaVersion: 1 })).toThrow(/screenId|elements/)
    expect(() => asScreenSpec(null)).toThrow()
    expect(() =>
      asScreenSpec({ schemaVersion: 1, screenId: 'X', source: {}, elements: 'nope' }),
    ).toThrow(/elements/)
  })

  it('실제 ONB-01 스펙은 통과한다', () => {
    expect(onb01.screenId).toBe('ONB-01')
    expect(onb01.elements.length).toBeGreaterThan(0)
  })
})

// 인자가 오가는 자리. 값의 출처가 넷이고, 그중 itemField는 명세도 화면도 모르는
// 값이다 — 눌린 그 행만 안다.
describe('resolveParams', () => {
  it('네 출처를 각각 제 곳에서 읽는다', () => {
    expect(
      resolveParams(
        {
          status: { value: 'planned' },
          scope: { fieldKey: 'taskScope' },
          eventId: { screenParam: 'eventId' },
          taskId: { itemField: 'id' },
        },
        {
          fields: { taskScope: 'mine' },
          screenParams: { eventId: 'E-01' },
          row: { id: 'T-03', title: '현수막 디자인 수정 반영' },
        },
      ),
    ).toEqual({ status: 'planned', scope: 'mine', eventId: 'E-01', taskId: 'T-03' })
  })

  it('가리키는 곳에 값이 없으면 조용히 다른 것을 집어 오지 않는다', () => {
    expect(
      resolveParams(
        { taskId: { itemField: '없는조각' }, eventId: { screenParam: 'eventId' } },
        { row: { id: 'T-03' } },
      ),
    ).toEqual({ taskId: '', eventId: '' })
  })
})

// meta.title은 화면의 이름이고, titleFrom이 있으면 그려지는 것은 데이터다.
describe('drawnTitleOf', () => {
  it('titleFrom이 없으면 meta.title이 그대로 그려진다', () => {
    expect(drawnTitleOf(task01)).toBe(task01.meta?.title)
  })

  it('titleFrom이 있으면 화면이 받은 인자로 한 건을 집어 그 값을 그린다', () => {
    expect(evtTask01.meta?.title).toBe('행사 업무 — 칸반 보드')
    expect(drawnTitleOf(evtTask01, { eventId: 'E-01' })).toBe(
      '2026 소프트웨어융합대학 체육대회',
    )
  })
})
