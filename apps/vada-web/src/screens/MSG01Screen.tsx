import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { findDataSource, readListSource } from '../data-sources/catalog'
import { elementByNodeId, msg01, nodeIdOf } from '../spec/screens'
import { targetScreenOf } from '../spec/types'
import type { ItemListSpec } from '../spec/types'

// 메시지 — 방 목록(MSG-01). 셸의 '메시지' 메뉴가 가리키는 화면 자신이다.
//
// **와이어프레임이 그린 것은 방이 하나도 없는 모습뿐이다.** 채워진 목록은 이
// 저장소의 어느 프레임에도 없다. 그래서 이 화면은 '빈 카드 하나'가 아니라
// **목록 하나**이고, 비었을 때 그 자리에 대신 그려지는 것이 지금 보이는 카드다
// (EVT-03A가 EVT-03C를 접은 것과 같은 자리다). summary + button으로 적었으면
// 방이 생긴 뒤에도 영영 빈 카드가 떴을 것이다.
//
// 비었다는 것을 말하는 것은 출처(message.rooms의 messages.empty)이고, 비었으니
// 채우라고 권하는 것은 명세(itemList.emptyAction)다. 화면은 둘을 그리기만 한다.
//
// **줄에 무엇이 그려지는지는 아무도 모른다.** 그래서 카탈로그의 조각은 방을
// 가리키는 값 하나뿐이고, 이 화면도 그 하나만 그린다 — 이름·마지막 말·안 읽은
// 수를 지어내면 그림에 없는 계약이 생기고, 그것은 서버가 지켜야 할 약속이 된다.
//
// design(30:6775)이 빈 카드 안에 설명 한 문단을 더 그렸다. **그 글은 이제 앉을
// 자리가 있다** — messages.emptyDetail이다. 세 프레임(EVT-03C·MSG-01·MSG-03)이
// 같은 자리에 부딪혀 만든 말이고, 그 전에는 화면이 그림에 있는 글을 그리지
// 못했다.

const SCREEN = 'MSG-01'

const NODE = {
  rooms: '30:6768',
} as const

const ASSET = {
  emptyIcon: '30:6769',
  emptyAddIcon: '30:6779',
} as const

interface MSG01ScreenProps {
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function MSG01Screen({ onNavigate }: MSG01ScreenProps) {
  const rooms = elementByNodeId(msg01, NODE.rooms).spec as ItemListSpec
  const source = findDataSource(rooms.dataSourceKey)
  const items = readListSource(rooms.dataSourceKey)

  return (
    <AppShell
      screenId={msg01.screenId}
      eyebrow={msg01.meta?.eyebrow}
      title={msg01.meta?.title ?? msg01.screenId}
      onNavigate={onNavigate}
    >
      <div
        data-node-id={nodeIdOf(msg01, rooms)}
        className="rounded-lg border border-gray-200 bg-white"
      >
        {items.length > 0 ? (
          // 명세가 columns도 itemFields도 갖지 않는다 — 줄이 무엇으로 이루어지는지
          // 그림이 말하지 않기 때문이다. 그래서 카탈로그가 선언한 조각만 그린다.
          // 개발용 응답이 비어 있으므로 이 가지는 지금 돌지 않는다.
          <ul className="divide-y divide-gray-100">
            {items.map((row) => (
              <li key={String(row.id)} className="px-6 py-4 text-sm text-gray-900">
                {source.fields.map((field) => (
                  <span key={field.key} className="block">
                    {String(row[field.key] ?? '')}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          // 여기서는 data-design-state를 달지 않는다. EVT-03A는 빈 상태의 그림이
          // **다른 프레임**에 있어 색을 견줄 원본이 없었지만, MSG-01은 그림 자체가
          // 빈 상태라 색·굵기가 이 화면의 design에 그대로 있다.
          <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.emptyIcon} className="size-14" />
            <p className="text-base font-bold text-gray-900">{source.messages.empty}</p>
            {source.messages.emptyDetail === undefined ? null : (
              // 비었다는 말 아래의 설명. **줄바꿈은 글 안에 있다** — 몇 줄로 그릴지는
              // 표현이라 명세가 정하지 않는다.
              <p className="text-xs whitespace-pre-line text-gray-500">
                {source.messages.emptyDetail}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                const action = rooms.emptyAction
                if (action === undefined) return
                const target = targetScreenOf(action, {})
                if (target !== null) onNavigate(target)
              }}
              className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              <FigmaAsset
                screenId={SCREEN}
                nodeId={ASSET.emptyAddIcon}
                className="size-3.5"
              />
              {rooms.emptyAction?.label}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
