import type { FinanceOverviewEvent } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { TwoPartMeter } from '@/components/TwoPartMeter'
import { Button } from '@/components/ui/button'
import { rowLinkBox } from '@/components/ui/row-link'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { signedWon } from './closing-view'
import { nameLinkClass, rowNameLinkClass } from './event-settlement-view'
import { wholeRateOf } from './overview-view'
import { wonLabel } from './purchase-view'

type Props = {
  rows: FinanceOverviewEvent[]
  // 넓은 화면(lg)은 표, 그보다 좁으면 카드 줄이다(재정 '행사 정산' 탭과 같은 판정).
  wide: boolean
  // 그 행사의 '예산·정산' 탭으로 간다.
  onOpen: (eventId: string) => void
}

const head = 'px-4 py-2 text-xs font-medium text-fg-muted'
const money = 'px-3 py-3 text-right text-sm whitespace-nowrap text-fg-secondary tabular-nums'
const availableTone = (available: number) =>
  available < 0 ? 'text-danger-emphasis' : 'text-primary-emphasis'

// 행사 줄의 집행률: (실제 + 예정) ÷ 배정과 두 겹 막대(와이어프레임 FIN-00 행사별 표).
function RowRate({ row }: { row: FinanceOverviewEvent }) {
  const rate = wholeRateOf(row.actual + row.committed, row.amount)
  if (rate === null) return null
  return (
    <div className="flex items-center justify-end gap-2">
      <TwoPartMeter
        className="w-12"
        first={row.actual}
        second={row.committed}
        max={row.amount}
        labels={{ first: `${row.event.name} 실제 지출`, both: `${row.event.name} 지출 예정 포함` }}
      />
      <span className="w-9 text-right text-xs text-fg-secondary tabular-nums">{rate}%</span>
    </div>
  )
}

function EventTable({ rows, onOpen }: Omit<Props, 'wide'>) {
  return (
    <table aria-label="행사별 예산" className="w-full border-collapse text-left">
      <thead className="bg-surface-subtle">
        <tr>
          <th scope="col" className={cn(head, 'min-w-32')}>
            구분
          </th>
          {['배정 예산', '실제 지출', '지출 예정', '사용 가능'].map(label => (
            <th key={label} scope="col" className={cn(head, 'w-28 px-3 text-right')}>
              {label}
            </th>
          ))}
          <th scope="col" className={cn(head, 'w-32 text-right')}>
            집행률
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr
            key={row.event.id}
            className="cursor-pointer border-t transition-colors hover:bg-surface-subtle has-[:focus-visible]:bg-surface-muted"
            onClick={() => onOpen(row.event.id)}
          >
            <td className="px-4 py-3">
              {/* 누르기는 줄이 받는다(버튼의 클릭이 줄로 올라간다). 버튼은 키보드로 여는 길이다. */}
              <Button variant="link" className={nameLinkClass} title={row.event.name}>
                <span className="line-clamp-2">{row.event.name}</span>
              </Button>
            </td>
            <td className={money}>{wonLabel(row.amount)}</td>
            <td className={money}>{wonLabel(row.actual)}</td>
            <td className={money}>{wonLabel(row.committed)}</td>
            <td className={cn(money, 'font-semibold', availableTone(row.available))}>
              {signedWon(row.available)}
            </td>
            <td className="px-4 py-3">
              <RowRate row={row} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EventList({ rows, onOpen }: Omit<Props, 'wide'>) {
  return (
    <ul aria-label="행사별 예산" className="flex flex-col divide-y">
      {rows.map(row => (
        <li
          key={row.event.id}
          className={`${rowLinkBox} flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-surface-subtle`}
        >
          <div className="flex items-start gap-3">
            <Button
              variant="link"
              className={`min-w-0 flex-1 ${rowNameLinkClass}`}
              title={row.event.name}
              onClick={() => onOpen(row.event.id)}
            >
              <span className="line-clamp-2">{row.event.name}</span>
            </Button>
            <span
              className={cn(
                'shrink-0 text-sm font-semibold tabular-nums',
                availableTone(row.available),
              )}
            >
              {signedWon(row.available)}
            </span>
          </div>
          <p className="text-xs text-fg-muted tabular-nums">
            {[
              `배정 ${wonLabel(row.amount)}`,
              `실제 ${wonLabel(row.actual)}`,
              `예정 ${wonLabel(row.committed)}`,
            ].map((part, index) => (
              <span key={part}>
                {index > 0 && ' · '}
                <span className="whitespace-nowrap">{part}</span>
              </span>
            ))}
          </p>
          <RowRate row={row} />
        </li>
      ))}
    </ul>
  )
}

// 행사별 표(DEC-92): 행사를 고른 지출 예산 항목의 배정, 실제, 예정, 사용 가능. 줄을 누르면 그 행사의 예산·정산이 열린다.
// 와이어프레임의 '부서별' 탭은 두지 않는다(DEC-92: 예산 항목에 부서가 없다).
export function OverviewEvents({ rows, wide, onOpen }: Props) {
  return (
    <section aria-label="행사별" className={cn(cardClass, 'overflow-hidden')}>
      <h3 className="border-b px-4 py-3 text-sm font-semibold text-fg">행사별</h3>
      {rows.length === 0 ? (
        <div className="p-4">
          <StateMessage kind="empty">행사 예산 없음</StateMessage>
        </div>
      ) : wide ? (
        <EventTable rows={rows} onOpen={onOpen} />
      ) : (
        <EventList rows={rows} onOpen={onOpen} />
      )}
    </section>
  )
}
