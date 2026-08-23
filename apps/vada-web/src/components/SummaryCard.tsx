interface SummaryItem {
  label: string
  value: string
}

interface SummaryCardProps {
  /** design 대조가 이 카드를 찾아가는 끈(spec/screens.ts의 nodeIdOf). */
  nodeId?: string
  eyebrow?: string
  title: string
  items: SummaryItem[]
}

// 이 화면이 다루는 대상을 보여주는 요약 카드(summary 요소).
// 카드 14:13: 테두리 gray-200, radius 9.25→rounded-xl, padding 21→24.
// 눈썹·라벨 10.5→text-xs gray-400, 제목 14→text-base semibold gray-900,
// 값 10.5→text-xs gray-700. 행 gap 10.5→3, 목록 gap 8.75→2.5, pt 14→4.
export function SummaryCard({ nodeId, eyebrow, title, items }: SummaryCardProps) {
  return (
    <div data-node-id={nodeId} className="rounded-xl border border-gray-200 p-6">
      {eyebrow && <p className="text-xs text-gray-400">{eyebrow}</p>}
      <h2 className="pt-1 text-base font-semibold text-gray-900">{title}</h2>
      <dl className="flex flex-col gap-2.5 pt-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <dt className="w-20 shrink-0 text-xs text-gray-400">{item.label}</dt>
            <dd className="min-w-0 text-xs break-words text-gray-700">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
