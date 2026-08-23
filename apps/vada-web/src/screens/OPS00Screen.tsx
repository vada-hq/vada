import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { readObjectSource } from '../data-sources/catalog'
import { elementByNodeId, ops00 } from '../spec/screens'
import type { DisplayAction, SummarySpec } from '../spec/types'

// 운영 허브(OPS-00).
//
// 네 개의 운영 공간을 고르는 화면이다. 카드 하나하나가 `summary`다 — 제목·설명과
// 서버에서 읽는 라벨-값 쌍을 가지며, 카드 전체가 눌린다(`summary.action`).
// 별도의 button 요소로 가르지 않은 이유는 디자인에서 카드 전체가 하나의 버튼이고
// 등록 노드 계약상 한 노드는 한 요소이기 때문이다.
//
// 공간이 넷이라는 것은 명세가 정한다(모든 조직이 같다). 각 공간의 건수만
// 서버에서 온다. 그래서 itemList가 아니라 summary 넷이다.

const SCREEN = 'OPS-00'

const NODE = {
  intro: '16:593',
  menuHeading: '16:604',
  cards: ['16:614', '16:643', '16:674', '16:702'],
} as const

// 아이콘은 figma.design.json이 assetRef로 가리킨다. 카드마다 다르므로
// 등록 노드로 찾는다 — 순서에 기대지 않는다.
const ASSET = {
  intro: '16:594',
  cardIcon: {
    '16:614': '16:615',
    '16:643': '16:644',
    '16:674': '16:675',
    '16:702': '16:703',
  } as Record<string, string>,
  cardArrow: {
    '16:614': '16:641',
    '16:643': '16:672',
    '16:674': '16:700',
    '16:702': '16:731',
  } as Record<string, string>,
} as const

interface OPS00ScreenProps {
  onNavigate: (screenId: string) => void
}

export function OPS00Screen({ onNavigate }: OPS00ScreenProps) {
  const intro = elementByNodeId(ops00, NODE.intro).spec as SummarySpec
  const menu = elementByNodeId(ops00, NODE.menuHeading).spec as SummarySpec
  const introRow = intro.dataSourceKey ? readObjectSource(intro.dataSourceKey) : null

  return (
    <AppShell
      screenId={ops00.screenId}
      eyebrow={ops00.meta?.eyebrow}
      title={ops00.meta?.title ?? ops00.screenId}
      footerNote={ops00.meta?.footerNote}
      onNavigate={onNavigate}
    >
      <div
        data-node-id={NODE.intro}
        className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.intro} className="mt-0.5 size-5" />
        <span>
          <span className="block text-sm font-bold text-blue-950">{intro.title}</span>
          <span className="block pt-0.5 text-xs text-blue-800">
            {intro.descriptionField && introRow
              ? String(introRow[intro.descriptionField])
              : intro.description}
          </span>
        </span>
      </div>

      <div data-node-id={NODE.menuHeading} className="pt-6">
        <span className="flex items-baseline gap-2">
          <h2 className="text-sm font-bold text-gray-900">{menu.title}</h2>
          {/* 공간 수는 명세에 없다. 카드 수가 곧 공간 수다. */}
          <span className="text-xs text-gray-400">{`${NODE.cards.length}개 공간`}</span>
        </span>
        <p className="pt-0.5 text-xs text-gray-400">{menu.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 pt-3 lg:grid-cols-2">
        {NODE.cards.map((nodeId) => (
          <SpaceCard key={nodeId} nodeId={nodeId} onNavigate={onNavigate} />
        ))}
      </div>
    </AppShell>
  )
}

// 공간마다 테두리 색이 다르다. 어느 공간이냐는 등록 노드가 말하고 무슨 색이냐는
// design이 말한다 — 자산을 등록 노드로 찾는 것과 같은 방식이다.
const CARD_BORDER: Record<string, string> = {
  '16:614': 'border-blue-200',
  '16:643': 'border-indigo-200',
  '16:674': 'border-purple-200',
  '16:702': 'border-orange-200',
}

interface SpaceCardProps {
  nodeId: string
  onNavigate: (screenId: string) => void
}

function SpaceCard({ nodeId, onNavigate }: SpaceCardProps) {
  const spec = elementByNodeId(ops00, nodeId).spec as SummarySpec
  const stats = spec.dataSourceKey ? readObjectSource(spec.dataSourceKey) : null
  const [note, setNote] = useState<string | null>(null)
  const action: DisplayAction | undefined = spec.action

  return (
    <div
      data-node-id={nodeId}
      className={`rounded-xl border bg-white ${CARD_BORDER[nodeId] ?? 'border-gray-200'}`}
    >
      <button
        type="button"
        onClick={() => {
          if (action === undefined) return
          if (action.type === 'navigate') {
            onNavigate(action.targetScreenId)
            return
          }
          setNote(action.note)
        }}
        className="w-full px-5 py-4 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        {/* 자산이 카드 머리 줄 전체(아이콘 + 오른쪽 표시)를 한 덩이로 담고 있다.
            자산 단위 규칙이 나란한 두 아이콘을 가르지 못한 결과라 원래 비율로 그린다. */}
        <FigmaAsset
          screenId={SCREEN}
          nodeId={ASSET.cardIcon[nodeId]}
          className="block h-auto w-full"
        />
        <span className="block pt-2 text-sm font-bold text-gray-900">{spec.title}</span>
        <span className="block pt-0.5 text-xs font-medium text-gray-500">
          {spec.description}
        </span>

        {/* 두 타일을 함께 감싼 칸 16:628에 테두리가 있다(타일 자체엔 없다). */}
        <span className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-gray-100 p-1">
          {(spec.items ?? []).map((item) => (
            <span
              key={item.label}
              className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-400"
            >
              <span className="block">{item.label}</span>
              <span className="block pt-0.5 text-sm font-bold text-gray-800">
                {`${item.field && stats ? stats[item.field] : (item.value ?? '')}${item.unit ?? ''}`}
              </span>
            </span>
          ))}
        </span>

        {action?.label === undefined ? null : (
          <span className="flex items-center gap-1 pt-3 text-xs font-medium text-blue-600">
            {action.label}
            <FigmaAsset
              screenId={SCREEN}
              nodeId={ASSET.cardArrow[nodeId]}
              className="size-3"
            />
          </span>
        )}
      </button>
      {note === null ? null : (
        <p className="border-t border-gray-200 px-5 py-2 text-xs text-gray-500">{note}</p>
      )}
    </div>
  )
}
