import { describe, expect, it } from 'vitest'
import { asFlowsCatalog, findFlowStep, isBackwardNavigation } from './flows'

describe('flows', () => {
  it('화면의 단계 번호와 단계별 라벨을 배열 위치에서 계산한다 (마찰 11)', () => {
    expect(findFlowStep('ONB-01')).toEqual({ label: '기본 설정', step: 1, total: 2 })
    expect(findFlowStep('ONB-02')).toEqual({ label: '시작 방식 선택', step: 2, total: 2 })
    // 어느 흐름에도 없는 화면은 null. 실제 화면 id를 쓰면 화면을 흐름에 추가할
    // 때마다 이 단언이 깨지므로, 카탈로그에 절대 없는 id로 불변식만 검사한다.
    expect(findFlowStep('NOT-IN-ANY-FLOW')).toBeNull()
  })

  it('흐름 순서로 뒤로 가는 이동을 판별한다', () => {
    expect(isBackwardNavigation('ONB-02', 'ONB-01')).toBe(true)
    expect(isBackwardNavigation('ONB-01', 'ONB-02')).toBe(false)
    // 다른 흐름으로의 이동은 순서를 비교할 수 없으므로 뒤로가 아니다.
    expect(isBackwardNavigation('ONB-02', 'ORG-01')).toBe(false)
  })

  it('형태가 깨진 흐름 카탈로그는 명확히 거부한다', () => {
    expect(() => asFlowsCatalog({ schemaVersion: 1 })).toThrow(/flows/)
    expect(() =>
      asFlowsCatalog({
        schemaVersion: 1,
        flows: [
          { key: 'a', screens: [{ screenId: 'S-1', label: '하나' }] },
          { key: 'b', screens: [{ screenId: 'S-1', label: '다른 하나' }] },
        ],
      }),
    ).toThrow(/여러 흐름/)
  })
})
