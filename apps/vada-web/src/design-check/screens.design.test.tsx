import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { getOptionSource } from '../option-sources/catalog'
import { ScreenRouter } from '../screens/ScreenRouter'
import { ALL_SCREENS, exampleParamsOf } from '../spec/screens'
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

// design 파일은 번들러를 거치지 않고 파일에서 읽는다.
//
// import.meta.glob으로 불러오면 vite가 화면마다 JSON을 ES 모듈로 바꾼다. 지금
// 15개 합쳐 6MB고, 그 변환이 dom 검사 전체에서 가장 큰 값이었다(측정: 이 파일
// 하나가 39초 중 14초, 프로젝트 전체의 import 36초). 검사는 Node에서 도니
// 읽기만 하면 되고, 화면이 늘 때마다 6MB가 커지는 자리를 없앤다.
//
// 경로는 import.meta.url에서 얻지 않는다 — vitest 안에서 그것은 dev 서버의 http
// 주소라 파일 경로가 아니다. vitest의 root가 이 앱이므로 거기서 올라간다.
const SCREENS_DIR = join(
  process.cwd(),
  '../../specs/figma/vada-wireframe/screens',
)

// 그림의 '내용'이 있어야 같은 그림인지 가릴 수 있다. 파일 이름은 노드 id라 자리마다
// 다르고, img의 src는 번들러가 만든 주소라 되짚을 수 없다.
//
// design 파일과 **같은 이유로** 번들러를 거치지 않는다. glob으로 불러오면 vite가
// 화면마다 SVG를 ES 모듈로 바꾸는데, 지금 391개다. 검사는 Node에서 도니 읽기만
// 하면 되고, 화면이 늘 때마다 커지는 자리를 하나 더 만들지 않는다.
// (실측: 게이트 벽시계가 예산 60초 언저리에서 흔들렸고 이것이 그 몫이었다.)
const assetSources = new Map<string, string>()

function drawingOfScreen(screenId: string): (file: string) => string {
  return (file) => {
    const source = assetSources.get(`${screenId}/${file}`)
    // png는 raw로 읽지 않는다. 내용을 모르면 파일 이름이 곧 그 그림이다.
    return source === undefined ? file : drawingKey(source)
  }
}

// 화면 아홉 개의 design을 한꺼번에 안고 있으면 무겁다. 필요한 것만 불러 쓴다.
const designByScreenId = new Map<string, DesignFile>()

beforeAll(() => {
  for (const screenId of readdirSync(SCREENS_DIR)) {
    const file = join(SCREENS_DIR, screenId, 'figma.design.json')
    if (!existsSync(file)) {
      continue
    }
    designByScreenId.set(screenId, JSON.parse(readFileSync(file, 'utf-8')) as DesignFile)

    const assetsDir = join(SCREENS_DIR, screenId, 'assets')
    if (!existsSync(assetsDir)) {
      continue
    }
    for (const name of readdirSync(assetsDir)) {
      if (!name.endsWith('.svg')) {
        continue
      }
      assetSources.set(
        `${screenId}/assets/${name}`,
        readFileSync(join(assetsDir, name), 'utf-8'),
      )
    }
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
    const drawn = textsIn(findNode(design.root, element.source?.nodeId ?? ""))
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
// 카드 화면은 셸이 없어 로고를 자기가 그린다. 셸 화면은 로고가 사이드바에 있고
// 머리에는 눈썹이 온다.
//
// 한동안 이 목록을 `stateScopeKey !== undefined`로 골랐다 - 초안을 담는 화면이
// 곧 카드 화면이던 시절의 대용이다. **ORG-03B가 그 가정을 깼다**: 조직도를 고치는
// 화면은 초안도 담고 셸도 쓴다. 그래서 design이 실제로 사이드바를 그리는지로
// 가른다 - 재려던 것을 그대로 재는 것이 대용보다 낫다.

// 이 검사가 채점하는 것은 **PageCard의 두 머리 갈래**다(로고형 · 눈썹형).
//
// 한동안 '사이드바를 그리지 않는 화면'으로 골랐는데, 그것은 그릇이 아니라 그림을
// 보고 고르는 것이다. 머리가 **아예 없는** 화면이 들어오면 그림에 없는 눈썹을
// 요구받는다 — 학생회 밖에서 보는 화면 셋이 그렇다.
//
// 짝 검사가 AppShell을 재는 방식 그대로, 화면이 그 그릇을 쓰는지로 고른다.
// 화면 부품의 소스. 어느 그릇을 쓰는지는 명세가 아니라 구현의 사실이다.
function sourceOf(screenId: string): string {
  return readFileSync(
    join(fileURLToPath(new URL('../screens/', import.meta.url)), `${screenId.replace(/-/g, '')}Screen.tsx`),
    'utf-8',
  )
}

const CARD_SCREENS = ALL_SCREENS.filter(
  (spec) => designByScreenId.has(spec.screenId) && /PageCard/.test(sourceOf(spec.screenId)),
)

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

/**
 * 이 화면이 **펼쳐 그리는 원격 선택지**를 갖는가.
 *
 * choiceGroup은 선택지를 접어 두지 않고 전부 그린다. 그 목록이 원격이면 값이
 * 늦게 오는데, 대조는 render() 직후 동기로 돈다 — 그래서 MSG-02의 분류 셋이
 * '화면에 없음'으로 잡혔다. **화면이 틀린 것이 아니라 견주는 순간이 이른 것이다.**
 *
 * choiceGroup 열여섯이 전부 static이던 동안은 드러나지 않았다. 예외로 덮으면
 * 다음 화면에서 또 여섯 줄을 적게 되므로 여기서 기다린다.
 */
function drawsRemoteChoices(spec: ScreenSpec): boolean {
  const walk = (entries: readonly { spec?: unknown }[]): unknown[] =>
    entries.flatMap((entry) => [
      entry.spec,
      ...walk((entry.spec as { itemFields?: { spec?: unknown }[] })?.itemFields ?? []),
    ])

  return walk(spec.elements).some((element) => {
    const candidate = element as {
      type?: string
      presentation?: string
      optionsSource?: { key?: string }
    }
    if (candidate.type !== 'select' || candidate.presentation !== 'choiceGroup') {
      return false
    }
    const key = candidate.optionsSource?.key
    return key !== undefined && getOptionSource(key).type === 'remote'
  })
}

// 화면마다의 검사가 **이미 견준 것**을 여기 모은다. 예외 목록이 썩지 않는지는
// 화면 전부를 모아야 판정할 수 있는데(규칙에 건 예외는 여러 화면에 걸쳐 쓰인다),
// 그것을 위해 82개를 **다시 그리고 있었다.** 한 화면이 세 번 그려졌고 그 한
// 검사가 25초였다.
//
// 견주는 일은 이미 위에서 다 한다. 결과만 흘려보내면 아래 검사는 셈만 하면 된다.
const SEEN: SeenDifference[] = []
const SEEN_SCREENS = new Set<string>()

describe.each(ALL_SCREENS.map((spec) => ({ screenId: spec.screenId, spec })))(
  '$screenId design 대조',
  ({ screenId, spec }) => {
    it('등록 노드의 글과 칸을 design과 같은 색·굵기로 그린다', async () => {
      const design = designByScreenId.get(screenId)
      if (design === undefined) {
        throw new Error(`design 파일이 없습니다: ${screenId}`)
      }

      render(
        <ScreenRouter
          screenParams={exampleParamsOf(screenId)}
          screenId={screenId}
          scopes={scopesDrawnBy(spec, design)}
          onChangeScope={() => {}}
          onNavigate={() => {}}
        />,
      )

      // 원격 선택지는 늦게 온다. 그것을 그리는 화면만 기다린다 — 나머지는
      // 이 자리를 스치고 지나간다.
      if (drawsRemoteChoices(spec)) {
        await waitFor(() => {
          expect(document.querySelectorAll('[role="radio"]').length).toBeGreaterThan(0)
        })
      }

      // 일부러 다르게 하기로 한 자리는 덜어낸다. 그 목록이 썩지 않는지는 화면
      // 하나로 판정할 수 없다(규칙에 건 예외는 여러 화면에 걸쳐 쓰인다) — 아래에
      // 화면 전부를 모아 보는 검사가 따로 있다.
      const found = compareScreen(document.body, spec, design)
      for (const difference of found) {
        SEEN.push({ ...difference, screenId })
      }
      SEEN_SCREENS.add(screenId)

      const remaining = applyDeviations(screenId, found, DEVIATIONS)

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
          screenParams={exampleParamsOf(screenId)}
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

      const found = compareScreenAssets(container, spec, design, drawingOfScreen(screenId))
      for (const difference of found) {
        SEEN.push({ ...difference, screenId })
      }

      const missing = applyDeviations(screenId, found, DEVIATIONS)
      expect(missing, report(screenId, missing)).toEqual([])
    })
  },
)

// 예외 목록이 썩지 않는지는 화면 전부를 모아야 판정할 수 있다. 규칙에 건 예외는
// 여러 화면에 걸쳐 쓰이므로, 화면마다 따로 물으면 안 쓰인 화면에서 거짓 경보가 난다.
describe('design/deviations.ts', () => {
  // **다시 그리지 않는다.** 위의 화면별 검사가 견준 것을 그대로 센다 — 예전에는
  // 여기서 82개를 통째로 다시 그렸고, 한 화면이 세 번 그려졌다. 그 한 검사가
  // 25초라 기본 제한 20초에 걸려 있었고, 그 빨간불은 **시계의 것이지 논리의
  // 것이 아니었다** — 기계가 빠른 날은 초록이었다.
  //
  // 대신 **부분 실행에서는 판정하지 않는다.** 화면 몇 개만 돌린 뒤 "예외가 안
  // 쓰인다"고 말하면 멀쩡한 예외를 지우게 된다.
  it('쓰이지 않는 예외가 없다', () => {
    const missing = ALL_SCREENS.map((spec) => spec.screenId).filter(
      (screenId) => !SEEN_SCREENS.has(screenId),
    )
    if (missing.length > 0) {
      throw new Error(
        '화면 전부를 견주지 않았으므로 예외가 썩었는지 판정할 수 없습니다. ' +
          `안 본 화면 ${missing.length}개: ${missing.slice(0, 5).join(' · ')}`,
      )
    }

    const unused = unusedDeviations(SEEN, DEVIATIONS)
    expect(unused, staleReport(unused)).toEqual([])
  })
})
