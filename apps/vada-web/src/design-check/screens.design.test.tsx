import { beforeAll, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ScreenRouter } from '../screens/ScreenRouter'
import { ALL_SCREENS } from '../spec/screens'
import type { ScreenSpec } from '../spec/types'
import type { ScopeStore } from '../state/scopes'
import {
  applyDeviations,
  compareScreen,
  compareScreenAssets,
  findNode,
  report,
  staleReport,
  textsIn,
  drawingKey,
  unusedDeviations,
  usesVectorUnitAssets,
} from '.'
import type { DesignFile, SeenDifference } from '.'
import { DEVIATIONS } from '../design/deviations'

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

// 그림의 '내용'이 있어야 같은 그림인지 가릴 수 있다. 파일 이름은 노드 id라 자리마다
// 다르고, img의 src는 번들러가 만든 주소라 되짚을 수 없다.
const ASSET_SOURCES = import.meta.glob(
  '../../../../specs/figma/vada-wireframe/screens/*/assets/*.svg',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

function drawingOfScreen(screenId: string): (file: string) => string {
  const prefix = `../../../../specs/figma/vada-wireframe/screens/${screenId}/`
  return (file) => {
    const source = ASSET_SOURCES[`${prefix}${file}`]
    // png는 raw로 읽지 않는다. 내용을 모르면 파일 이름이 곧 그 그림이다.
    return source === undefined ? file : drawingKey(source)
  }
}

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

// 머리 형태는 화면이 고르지 않고 meta.eyebrow가 정한다(components/PageCard.tsx).
// 그 규칙이 design과 맞는지를 여기서 채점한다 — 짐작을 코드에 적어 두고 아무도
// 확인하지 않으면, 여섯 번째 카드형 화면에서 조용히 틀린다.
//
// 카드형 화면에만 적용한다. 셸이 있는 화면은 로고가 사이드바에 있어서 머리의
// 눈썹과 로고가 함께 나온다(MY-01·OPS-00).
const CARD_SCREENS = ALL_SCREENS.filter((spec) => spec.stateScopeKey !== undefined)

describe.each(CARD_SCREENS.map((spec) => ({ screenId: spec.screenId, spec })))(
  '$screenId 머리 형태',
  ({ screenId, spec }) => {
    it('눈썹이 있으면 design에 로고가 없고, 없으면 있다', () => {
      const design = designByScreenId.get(screenId)
      if (design === undefined) {
        throw new Error(`design 파일이 없습니다: ${screenId}`)
      }
      const drawsLogo = textsIn(design.root).some((text) => text.content === 'Vada')
      const hasEyebrow = spec.meta?.eyebrow !== undefined && spec.meta.eyebrow !== null

      expect(
        hasEyebrow,
        hasEyebrow
          ? `${screenId}: meta.eyebrow가 있으니 제목형인데 design은 로고를 그립니다.`
          : `${screenId}: meta.eyebrow가 없으니 로고형인데 design은 로고를 그리지 않습니다.`,
      ).toBe(!drawsLogo)
    })
  },
)

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

      // 일부러 다르게 하기로 한 자리는 덜어낸다. 그 목록이 썩지 않는지는 화면
      // 하나로 판정할 수 없다(규칙에 건 예외는 여러 화면에 걸쳐 쓰인다) — 아래에
      // 화면 전부를 모아 보는 검사가 따로 있다.
      const remaining = applyDeviations(
        screenId,
        compareScreen(document.body, spec, design),
        DEVIATIONS,
      )

      expect(remaining, report(screenId, remaining)).toEqual([])
    })

    // 그림이 통째로 빠져도 글 대조는 조용하다. MY-01·OPS-00에서 실제로 두 번
    // 그랬고, 그때는 사람이 스크린샷을 봐야만 잡혔다 — 그 개입을 없애는 검사다.
    it('design이 그림으로 뽑아 둔 자리를 모두 그린다', () => {
      const design = designByScreenId.get(screenId)
      if (design === undefined) {
        throw new Error(`design 파일이 없습니다: ${screenId}`)
      }

      const { container } = render(
        <ScreenRouter
          screenId={screenId}
          scopes={scopesDrawnBy(spec, design)}
          onChangeScope={() => {}}
          onNavigate={() => {}}
        />,
      )
      const drawn = container.querySelectorAll('[data-asset-node-id]').length

      if (usesVectorUnitAssets(design)) {
        // 이 화면의 자산은 벡터 조각 단위라 아이콘 하나로 그릴 수 없다(옛 추출기).
        // 그리지 않는 것이 지금의 사실이므로 그대로 못 박아 둔다 — Figma에서 이
        // 화면을 다시 저장하면 판정이 저절로 반대편으로 넘어간다(BACKLOG).
        expect(
          drawn,
          `${screenId}의 자산은 벡터 조각 단위입니다. 아이콘 단위로 다시 저장해야 그림을 대조할 수 있습니다.`,
        ).toBe(0)
        return
      }

      const missing = applyDeviations(
        screenId,
        compareScreenAssets(container, spec, design, drawingOfScreen(screenId)),
        DEVIATIONS,
      )
      expect(missing, report(screenId, missing)).toEqual([])
    })
  },
)

// 예외 목록이 썩지 않는지는 화면 전부를 모아야 판정할 수 있다. 규칙에 건 예외는
// 여러 화면에 걸쳐 쓰이므로, 화면마다 따로 물으면 안 쓰인 화면에서 거짓 경보가 난다.
describe('design/deviations.ts', () => {
  it('쓰이지 않는 예외가 없다', () => {
    const seen: SeenDifference[] = []
    for (const spec of ALL_SCREENS) {
      const design = designByScreenId.get(spec.screenId)
      if (design === undefined) {
        throw new Error(`design 파일이 없습니다: ${spec.screenId}`)
      }
      const { container } = render(
        <ScreenRouter
          screenId={spec.screenId}
          scopes={scopesDrawnBy(spec, design)}
          onChangeScope={() => {}}
          onNavigate={() => {}}
        />,
      )
      const found = [
        ...compareScreen(container, spec, design),
        // 그림 대조도 예외를 쓴다. 여기서 빠뜨리면 그림에 건 예외가 늘 '쓰이지 않는
        // 예외'로 잡힌다.
        ...(usesVectorUnitAssets(design)
          ? []
          : compareScreenAssets(container, spec, design, drawingOfScreen(spec.screenId))),
      ]
      for (const difference of found) {
        seen.push({ ...difference, screenId: spec.screenId })
      }
      cleanup()
    }

    const unused = unusedDeviations(seen, DEVIATIONS)
    expect(unused, staleReport(unused)).toEqual([])
  })
})
