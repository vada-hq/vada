import { beforeAll, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ScreenRouter } from '../screens/ScreenRouter'
import { ALL_SCREENS } from '../spec/screens'
import type { ScreenSpec } from '../spec/types'
import type { ScopeStore } from '../state/scopes'
import { compareScreen, findNode, report, textsIn } from '.'
import type { DesignFile } from '.'

// 모든 화면이 design과 같은 모습인지 대조한다.
//
// 화면마다 파일을 만들지 않는다 — 화면 목록은 이미 명세가 갖고 있고(ALL_SCREENS),
// design 파일도 화면 아이디로 찾아진다. 화면을 하나 더 만들면 이 검사가 저절로
// 따라붙는다. 대조를 붙이는 것을 잊을 자리가 없어야 한다.
//
// 대조 대상은 등록 노드의 안쪽이다 — 명세가 source.nodeId로 지목한 자리이므로,
// design과 화면이 만나야 하는 자리가 바로 거기다. 셸(사이드바·헤더)은 등록에서
// 빠져 있으므로 여기서도 빠진다.

const DESIGN_MODULES = import.meta.glob(
  '../../../../specs/figma/vada-wireframe/screens/*/figma.design.json',
  { import: 'default' },
)

// 화면 아홉 개의 design을 한꺼번에 안고 있으면 무겁다. 필요한 것만 불러 쓴다.
const designByScreenId = new Map<string, DesignFile>()

beforeAll(async () => {
  for (const [path, load] of Object.entries(DESIGN_MODULES)) {
    const screenId = path.split('/').at(-2) ?? ''
    designByScreenId.set(screenId, (await load()) as DesignFile)
  }
})

// design이 그린 상태로 화면을 열어 둔다.
//
// 흐름 중간 화면은 앞 단계의 값이 있어야 제 모습이 된다 — ORG-01의 note는 온보딩에서
// 받은 소속을 되읽어 그리므로, 값이 없으면 그 자리가 아예 그려지지 않는다.
//
// 그 값을 여기 적지 않는다. design이 이미 그려 두었으므로 되꺼내면 된다: 그려진 글에서
// 명세의 prefix를 떼고 separator로 끊으면 fieldRefs 순서대로 값이 나온다.
function scopesDrawnBy(screen: ScreenSpec, design: DesignFile): ScopeStore {
  const store: ScopeStore = {}
  for (const element of screen.elements) {
    const spec = element.spec
    if (spec.type !== 'note') {
      continue
    }
    const drawn = textsIn(findNode(design.root, element.source.nodeId))
      .map((text) => text.content)
      .join('')
    const prefix = spec.prefix ?? ''
    const body = drawn.startsWith(prefix) ? drawn.slice(prefix.length) : drawn
    const parts = body.split(spec.separator ?? ' ')
    spec.fieldRefs.forEach((ref, index) => {
      const value = parts[index]
      if (value === undefined) {
        return
      }
      const draft = (store[ref.scope] ??= { values: {}, labels: {} })
      draft.values[ref.fieldKey] = value
      draft.labels[ref.fieldKey] = value
    })
  }
  return store
}

describe.each(ALL_SCREENS.map((spec) => ({ screenId: spec.screenId, spec })))(
  '$screenId design 대조',
  ({ screenId, spec }) => {
    it('등록 노드의 글과 칸을 design과 같은 색·굵기로 그린다', () => {
      const design = designByScreenId.get(screenId)
      if (design === undefined) {
        throw new Error(`design 파일이 없습니다: ${screenId}`)
      }

      render(
        <ScreenRouter
          screenId={screenId}
          scopes={scopesDrawnBy(spec, design)}
          onChangeScope={() => {}}
          onNavigate={() => {}}
        />,
      )

      const differences = compareScreen(document.body, spec, design)

      expect(differences, report(screenId, differences)).toEqual([])
    })
  },
)
