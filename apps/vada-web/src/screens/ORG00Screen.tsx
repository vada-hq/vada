import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { readObjectSource } from '../data-sources/catalog'
import { elementByNodeId, org00 } from '../spec/screens'
import { targetScreenOf } from '../spec/types'
import type { SummarySpec } from '../spec/types'

// 조직 관리 홈(ORG-00).
//
// 영역 셋을 고르는 허브다. 카드 하나하나가 `summary`이고 카드 전체가 눌린다
// (`summary.action`) — OPS-00과 같은 규칙이다. 영역이 셋이라는 것은 명세가 정하고
// (모든 조직이 같다) 곁들이는 한 줄만 서버가 준다. 그래서 itemList가 아니다.
//
// **셋이 저마다 다른 화면으로 간다**는 것도 목록이 아닌 이유다 —
// `itemList.itemAction`은 대상이 하나뿐이다.
//
// 곁들이는 줄은 **완성된 문장 하나**로 받는다. 디자인이 '부서 5개 · 구성원 18명'을
// 글자 하나로 그렸기 때문이다. 라벨과 값이 따로 그려지는 OPS-00의 타일과 다르고,
// 명세의 `items[].label`이 "그려지지 않는 자리에서는 없다"고 말하는 그 자리다.

const SCREEN = 'ORG-00'

// 카드마다 아이콘과 화살표가 다르다. 순서에 기대지 않고 등록 노드로 찾는다.
const CARDS = [
  { node: '30:4383', icon: '30:4384', chevron: '30:4397' },
  { node: '30:4399', icon: '30:4400', chevron: '30:4411' },
  { node: '30:4413', icon: '30:4414', chevron: '30:4425' },
] as const

interface ORG00ScreenProps {
  onNavigate: (screenId: string) => void
}

export function ORG00Screen({ onNavigate }: ORG00ScreenProps) {
  return (
    <AppShell
      screenId={org00.screenId}
      eyebrow={org00.meta?.eyebrow}
      title={org00.meta?.title ?? org00.screenId}
      description={org00.meta?.description}
      onNavigate={onNavigate}
    >
      {/* 카드 셋을 감싼 칸 30:4382는 한 열 세 줄이고 줄 사이가 10.5 → 12다. */}
      <div className="flex flex-col gap-3">
        {CARDS.map((card) => (
          <AreaCard key={card.node} card={card} onNavigate={onNavigate} />
        ))}
      </div>
    </AppShell>
  )
}

interface AreaCardProps {
  card: { node: string; icon: string; chevron: string }
  onNavigate: (screenId: string) => void
}

function AreaCard({ card, onNavigate }: AreaCardProps) {
  const spec = elementByNodeId(org00, card.node).spec as SummarySpec
  const [note, setNote] = useState<string | null>(null)

  // 곁들이는 줄은 조각 하나다. 라벨이 없는 것이 명세의 뜻이다 - 서버가 라벨까지
  // 품은 문장을 보내므로 화면이 앞에 다시 적을 자리가 없다.
  const summaryItem = spec.items?.[0]
  const row = spec.dataSourceKey ? readObjectSource(spec.dataSourceKey) : null
  const summaryLine =
    summaryItem?.field !== undefined && row !== null
      ? String(row[summaryItem.field])
      : (summaryItem?.value ?? '')

  const action = spec.action

  return (
    // 카드 30:4383: 728×101.75 → 832×116, 안쪽 여백 21 → 24, 사이 17.5 → 20.
    // **바탕과 테두리는 등록 노드가 가진다** - 안쪽 버튼에 주면 대조기가 등록
    // 노드에서 '지정 없음'을 본다(실제로 그렇게 어긋났다).
    <div
      data-node-id={card.node}
      className="rounded-xl border border-gray-200 bg-white"
    >
      <button
        type="button"
        onClick={() => {
          if (action === undefined) return
          if (action.type === 'navigate') {
            onNavigate(targetScreenOf(action, {}) ?? action.type)
            return
          }
          setNote(action.note)
        }}
        className="flex w-full items-center gap-5 rounded-xl px-6 py-6 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        {/* 아이콘 타일 30:4384는 38.5 → 44이고 바탕색까지 그림에 들어 있다. */}
        <FigmaAsset screenId={SCREEN} nodeId={card.icon} className="size-11 shrink-0" />
        <span className="flex-1">
          <span className="block text-sm font-bold text-gray-900">{spec.title}</span>
          <span className="block pt-1 text-xs font-medium text-gray-500">
            {spec.description}
          </span>
          <span className="block pt-1.5 text-[11px] font-medium text-gray-400">
            {summaryLine}
          </span>
        </span>
        <FigmaAsset screenId={SCREEN} nodeId={card.chevron} className="size-4 shrink-0" />
      </button>
      {note === null ? null : (
        <p className="border-t border-gray-200 px-6 py-2 text-xs text-gray-500">{note}</p>
      )}
    </div>
  )
}
