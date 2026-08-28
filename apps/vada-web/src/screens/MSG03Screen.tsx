import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { findDataSource, readListSource } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, msg03, nodeIdOf } from '../spec/screens'
import { targetScreenOf } from '../spec/types'
import type { ItemListSpec } from '../spec/types'

// 대화(MSG-03). 셸의 '메시지' 메뉴 아래에 있는 화면이라 메뉴는 MSG-01을 켠다
// (activeNavigationScreenId) — 이 화면을 가리키는 메뉴는 없다.
//
// 머리는 현재 위치 경로가 아니다. 조각이 '메시지' 하나뿐이고 breadcrumb은
// minItems가 2다 — 하나짜리 경로는 경로가 아니다. 그래서 meta.eyebrow와 제목이다
// (ORG-07B와 같은 자리).
//
// **MSG-01과 마찬가지로 그림이 빈 모습만 그렸다.** 그래서 이 화면도 빈 카드가
// 아니라 목록 하나이고, 비었을 때 그 자리에 대신 그려지는 것이 지금의 카드다.
//
// 다만 빈 상태의 글이 이상하다. '아직 대화할 방이 없습니다'는 주고받은 말이
// 없다는 뜻이 아니라 **들어갈 방 자체가 없다**는 뜻이다 — MSG-01의 빈 상태와 같은
// 사실을 다른 말로 말한다. 두 글이 다르므로 한 출처로 묶을 수 없어 출처를 따로
// 둔다(message.conversation). 이 화면이 채워졌을 때 무엇을 되풀이해 그리는지는
// 그림에 없다.
//
// design(30:7123)이 그린 설명 한 줄은 그리지 않는다. MSG-01과 같은 이유다 —
// 빈 상태의 둘째 줄이 앉을 자리가 카탈로그에 없다(보고서 참조).

const SCREEN = 'MSG-03'

const NODE = {
  conversation: '30:7116',
} as const

const ASSET = {
  emptyIcon: '30:7117',
} as const

interface MSG03ScreenProps {
  /** 어느 방의 대화인지. 방을 만든 직후에는 방금 만든 방이다. */
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function MSG03Screen({ screenParams, onNavigate }: MSG03ScreenProps) {
  const conversation = elementByNodeId(msg03, NODE.conversation).spec as ItemListSpec
  const source = findDataSource(conversation.dataSourceKey)
  // 어느 방의 대화인지 모르면 남의 대화를 보여주지 않는다.
  const missingParam = (msg03.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )

  // 인자가 비었을 때 빈 목록을 그리면 **'방이 없다'고 말하게 된다.** 실제로는
  // 어느 방인지 모르는 것이므로 그 사실을 그대로 낸다.
  if (missingParam !== undefined) {
    return (
      <AppShell
        screenId={msg03.screenId}
        activeNavigationScreenId={msg03.activeNavigationScreenId}
        eyebrow={msg03.meta?.eyebrow}
        title={msg03.meta?.title ?? msg03.screenId}
        onNavigate={onNavigate}
      >
        <p role="alert" className="pt-6 text-sm text-red-700">
          {missingParam.missingNote}
        </p>
      </AppShell>
    )
  }

  const items = readListSource(
    conversation.dataSourceKey,
    resolveParams(conversation.params, { screenParams }),
  )

  return (
    <AppShell
      screenId={msg03.screenId}
      activeNavigationScreenId={msg03.activeNavigationScreenId}
      eyebrow={msg03.meta?.eyebrow}
      title={msg03.meta?.title ?? msg03.screenId}
      onNavigate={onNavigate}
    >
      <div
        data-node-id={nodeIdOf(msg03, conversation)}
        className="rounded-lg border border-gray-200 bg-white"
      >
        {items.length > 0 ? (
          // 명세가 columns도 itemFields도 갖지 않는다 — 줄이 무엇으로 이루어지는지
          // 그림이 말하지 않기 때문이다. 카탈로그가 선언한 조각만 그린다.
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
                const action = conversation.emptyAction
                if (action === undefined) return
                const target = targetScreenOf(action, {})
                if (target !== null) onNavigate(target)
              }}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              {conversation.emptyAction?.label}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
