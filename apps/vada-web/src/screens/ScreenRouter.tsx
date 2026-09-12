import { PageCard } from '../components/PageCard'
import { dataSourceCallsOf, dataSourceKeysOf } from '../spec/screen-sources'
import { useSourceLoading } from '../data-sources/loading'
import { ScreenSkeleton } from '../components/Skeleton'
import { SourceGate } from '../components/SourceGate'
import { ALL_SCREENS } from '../spec/screens'
import { SCREEN_RENDERERS } from './routing'
import type { ScreenRouterProps } from './routing/types'

// 내비게이션 계약(element-types.md): 스펙의 targetScreenId가 구현에 등록되지
// 않은 화면이면 조용한 대체 없이 명시적 오류를 표시한다.
// 각 화면에는 자기 stateScopeKey의 초안을 전달한다. 여기에 더해, 부품 표를 쓰는
// 화면은 scopes 전체도 받는다 — note가 *다른* 스코프의 값을 읽기 때문이다.
// 지금 note가 없는 화면에도 넘긴다: 화면이 정하는 것은 자리뿐이어야 하고,
// note가 하나 생겼다고 배선을 다시 손볼 자리가 있으면 안 된다.
/**
 * 받아 오는 동안과 실패했을 때를 **그릇이 그린다.**
 *
 * 카탈로그가 출처마다 `loading`·`error`를 갖는데 화면은 `empty`만 읽고 있었다.
 * 까닭은 문구를 빠뜨린 것이 아니라 읽기가 전부 동기라서였다 — 기다리는 시간도
 * 실패할 통신도 없으면 그 두 문구가 그려질 순간이 없다(data-sources/loading.ts).
 *
 * 무엇을 기다리는지는 **명세가 안다.** 화면 코드를 읽지 않고 `dataSourceCallsOf`가
 * 답한다 — 무엇을 부르는지뿐 아니라 **어떤 인자로** 부르는지까지. 개발용 응답은
 * 기본적으로 즉시 답하므로 평소에는 이 자리를 스치고 지나간다 — 늦음과 실패는
 * 그것을 시험하는 검사가 켠다.
 *
 * 인자는 두 곳에서 온다. 주소가 실어 온 것(`screenParams`)과 이 화면의 스코프 초안이다.
 * **화면 컴포넌트 안의 `useState`는 여기서 안 보인다** — 검색어와 거르개가 그렇고,
 * 그 자리는 아직 서버로 못 부른다(`fromServer`가 터뜨린다).
 */
export function ScreenRouter(props: ScreenRouterProps) {
  const spec = ALL_SCREENS.find((entry) => entry.screenId === props.screenId)
  const draft = spec?.stateScopeKey === undefined ? undefined : props.scopes[spec.stateScopeKey]
  // 기다리는 동안 그릴 글은 key가 정하고, **어떤 인자로 부를지는 서버를 쓸 때만**
  // 센다 — 개발용 응답으로 도는 동안에는 쓰이지 않는 값이다.
  const loading = useSourceLoading(
    spec === undefined ? [] : dataSourceKeysOf(spec),
    () =>
      spec === undefined
        ? []
        : dataSourceCallsOf(spec, {
            screenParams: props.screenParams ?? {},
            ...(draft === undefined ? {} : { fields: draft.values }),
          }),
  )

  // **기다림이 두 번 보이지 않게 한다.**
  //
  // 여기서 미리 받는 동안과, 그 뒤 화면 안에서 읽는 동안(`SourceGate`) — 기다림은
  // 두 마디다. 한동안 앞마디는 맨 글이고 뒷마디는 회색 블록이라, 사람이 화면을 열면
  // **글이 떴다가 블록이 떴다.** 배포된 것을 보고 사람이 물었다(2026-09-06).
  //
  // 두 마디가 같은 것을 그리면 한 번 기다린 것으로 보인다. 글은 `aria-label`로 남는다.
  if (loading.status === 'loading') {
    return <ScreenSkeleton label={loading.messages.join(' · ')} />
  }
  // **실패는 글이다.** 회색 블록은 '오는 중'이라는 뜻이라 안 오는 것을 그것으로 그리면
  // 사람이 영영 기다린다.
  if (loading.status === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-6">
        <div role="alert" className="max-w-md text-center text-sm text-red-700">
          {loading.messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      </div>
    )
  }
  // **읽는 순간에야 정해지는 부름이 있다.** 검색어와 거르개는 화면 안의 칸에
  // 살아서 위의 미리 받기가 보지 못한다 — 그 부름은 그릇이 읽힐 때 받아 오고,
  // 그동안 여기가 카탈로그의 글을 그린다.
  return (
    <SourceGate
      screenId={props.screenId}
      sourceKeys={spec === undefined ? [] : dataSourceKeysOf(spec)}
      meta={spec?.meta}
      onNavigate={props.onNavigate}
    >
      <ScreenBody {...props} />
    </SourceGate>
  )
}

function ScreenBody({
  screenId,
  screenParams = {},
  scopes,
  onChangeScope,
  onNavigate,
  onScopeEvent = () => {},
}: ScreenRouterProps) {
  const renderScreen = SCREEN_RENDERERS.get(screenId)
  if (renderScreen !== undefined) {
    // JSX를 직접 돌려받아, 같은 화면의 변형 사이에서도 컴포넌트 상태를 유지한다.
    return renderScreen({ screenId, screenParams, scopes, onChangeScope, onNavigate, onScopeEvent })
  }

  return (
    <PageCard>
      <h1 className="text-lg font-semibold text-red-500">구현에 등록되지 않은 화면입니다</h1>
      <p className="pt-1 text-sm text-gray-500">
        스펙이 <code className="text-gray-800">{screenId}</code> 화면으로 이동을 선언했지만, 이
        화면은 아직 구현에 등록되지 않았습니다.
      </p>
      <div className="pt-6">
        <button
          type="button"
          onClick={() => onNavigate('ONB-01')}
          className="w-full rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          처음 화면으로 돌아가기
        </button>
      </div>
    </PageCard>
  )
}
