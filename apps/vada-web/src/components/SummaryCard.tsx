import { NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'

export interface SummaryItem {
  label: string
  value: string
}

interface SummaryCardProps {
  /** design 대조가 이 카드를 찾아가는 끈(spec/screens.ts의 nodeIdOf). */
  nodeId?: string
  eyebrow?: string
  title: string
  items: SummaryItem[]
  status?: {
    label: string
    tone: string
  }
  /** 같은 summary라도 값 하나를 머리에 강조하는 상세 카드 형태가 있다. */
  variant?: 'stacked' | 'detail'
}

// 이 화면이 다루는 대상을 보여주는 요약 카드(summary 요소).
// 카드 14:13: 테두리 gray-200, radius 9.25→rounded-xl, padding 21→24.
// 눈썹·라벨 10.5→text-xs gray-400, 제목 14→text-base semibold gray-900,
// 값 10.5→text-xs gray-700. 행 gap 10.5→3, 목록 gap 8.75→2.5, pt 14→4.
export function SummaryCard({
  nodeId,
  eyebrow,
  title,
  items,
  status,
  variant = 'stacked',
}: SummaryCardProps) {
  if (variant === 'detail') {
    const [featured, ...details] = items
    if (featured === undefined) {
      throw new Error('상세 요약 카드에는 강조할 항목이 하나 이상 필요합니다.')
    }

    return (
      <section
        data-node-id={nodeId}
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {eyebrow && <p className="text-xs font-normal text-gray-400">{eyebrow}</p>}
              {status && (
                <span
                  data-design-state
                  data-design-rule="state-chip"
                  className={`rounded border px-2 py-0.5 text-xs font-medium ${
                    STATE_CHIP[status.tone] ?? NEUTRAL_CHIP
                  }`}
                >
                  {status.label}
                </span>
              )}
            </div>
            <h2 className="pt-2 text-lg font-bold text-gray-900">{title}</h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold text-gray-400">{featured.label}</p>
            <p className="pt-1 text-xl font-bold text-gray-900">{featured.value}</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          {details.map((item) => (
            <div key={item.label}>
              <dt className="text-xs font-semibold text-gray-400">{item.label}</dt>
              <dd className="pt-0.5 text-xs font-normal text-gray-700">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    )
  }

  return (
    <div data-node-id={nodeId} className="rounded-xl border border-gray-200 bg-white p-6">
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
