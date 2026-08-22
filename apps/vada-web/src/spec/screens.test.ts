// @vitest-environment node
// DOM을 쓰지 않는 테스트다. jsdom을 띄우지 않으면 워커 기동이 빨라지고,
// 부하가 걸렸을 때 환경 준비가 타임아웃되는 경로 자체가 사라진다.
import { describe, expect, it } from 'vitest'
import { asScreenSpec, onb01 } from './screens'

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
