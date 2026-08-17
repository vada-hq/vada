import { describe, expect, it } from 'vitest'
import { asFlowsCatalog, findFlowStep } from './flows'

describe('flows', () => {
  it('화면의 흐름 단계를 배열 위치에서 계산한다 (마찰 11)', () => {
    expect(findFlowStep('ONB-01')).toEqual({ label: '기본 설정', step: 1, total: 2 })
    expect(findFlowStep('ONB-02')).toEqual({ label: '기본 설정', step: 2, total: 2 })
    expect(findFlowStep('ORG-01')).toBeNull()
  })

  it('형태가 깨진 흐름 카탈로그는 명확히 거부한다', () => {
    expect(() => asFlowsCatalog({ schemaVersion: 1 })).toThrow(/flows/)
    expect(() =>
      asFlowsCatalog({
        schemaVersion: 1,
        flows: [
          { key: 'a', label: '에이', screens: ['S-1'] },
          { key: 'b', label: '비', screens: ['S-1'] },
        ],
      }),
    ).toThrow(/여러 흐름/)
  })
})
