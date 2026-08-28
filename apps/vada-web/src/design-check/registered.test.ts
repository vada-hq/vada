import { describe, expect, it } from 'vitest'
import { registeredNodeIds } from '.'

// 대조는 **등록 노드 안에서만** 돈다. 그래서 무엇이 등록 노드인지가 곧 대조가
// 무엇을 지키는지다 — 그 셈이 조용히 틀리면 대조는 초록인 채로 아무것도 안 본다.

describe('등록 노드를 세는 법', () => {
  it('한 자리를 여러 번 그린 그림의 사본도 그 요소의 것이다', () => {
    // 같은 자리를 다른 값으로 그린 것이다. 참석 확인의 결과 여섯이 노드 대
    // 노드로 같고 서로 배타적이다 — 한 사람에게 하나만 온다.
    const ids = registeredNodeIds({
      screenId: 'S-01',
      elements: [
        {
          source: { nodeId: '1:2', alsoDrawnAt: ['1:3', '1:4'] },
          spec: { type: 'summary' },
        },
      ],
    })

    expect(ids).toContain('1:2')
    expect(ids).toContain('1:3')
    expect(ids).toContain('1:4')
  })

  it('사본을 말하지 않으면 그 자리는 아무의 것도 아니다', () => {
    const ids = registeredNodeIds({
      screenId: 'S-01',
      elements: [{ source: { nodeId: '1:2' }, spec: { type: 'summary' } }],
    })

    expect(ids).toEqual(['1:2'])
  })
})
