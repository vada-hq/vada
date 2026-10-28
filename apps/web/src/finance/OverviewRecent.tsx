import type { FinanceOverviewExpense } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { headLinkTouch, rowLinkBox } from '@/components/ui/row-link'
import { cardClass } from '@/components/ui/card'
import { dayLabel } from '@/lib/korean-date-text'
import { cn } from '@/lib/utils'
import { nameLinkClass, rowNameLinkClass } from './event-settlement-view'
import { placeOf } from './overview-view'
import { wonLabel } from './purchase-view'

type Props = {
  rows: FinanceOverviewExpense[]
  wide: boolean
  onOpen: (expenseId: string) => void
  onAll: () => void
}

const head = 'px-4 py-2 text-xs font-medium text-gray-500'
// 결제일은 한국 날짜다. 한국 자정으로 읽어 '10월 17일 (토)'로 쓴다.
const paidLabel = (paidOn: string) => dayLabel(`${paidOn}T00:00:00+09:00`)

function RecentTable({ rows, onOpen }: Pick<Props, 'rows' | 'onOpen'>) {
  return (
    <table aria-label="최근 지출 목록" className="w-full border-collapse text-left">
      <thead className="bg-gray-50">
        <tr>
          <th scope="col" className={cn(head, 'w-36')}>
            날짜
          </th>
          <th scope="col" className={head}>
            지출 내용
          </th>
          <th scope="col" className={cn(head, 'w-48')}>
            행사 또는 사용처
          </th>
          <th scope="col" className={cn(head, 'w-32 text-right')}>
            금액
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr
            key={row.id}
            className="cursor-pointer border-t transition-colors hover:bg-gray-50 has-[:focus-visible]:bg-gray-100"
            onClick={() => onOpen(row.id)}
          >
            <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-500">
              {paidLabel(row.paidOn)}
            </td>
            <td className="px-4 py-3">
              <Button variant="link" className={nameLinkClass}>
                <span className="line-clamp-2">{row.description}</span>
              </Button>
            </td>
            <td className="px-4 py-3 text-sm wrap-anywhere text-gray-700">{placeOf(row)}</td>
            <td className="px-4 py-3 text-right text-sm font-semibold whitespace-nowrap text-gray-900 tabular-nums">
              {wonLabel(row.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RecentList({ rows, onOpen }: Pick<Props, 'rows' | 'onOpen'>) {
  return (
    <ul aria-label="최근 지출 목록" className="flex flex-col divide-y">
      {rows.map(row => (
        <li
          key={row.id}
          className={`${rowLinkBox} flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-gray-50`}
        >
          <div className="flex items-start gap-3">
            <Button
              variant="link"
              className={`min-w-0 flex-1 ${rowNameLinkClass}`}
              onClick={() => onOpen(row.id)}
            >
              <span className="line-clamp-2">{row.description}</span>
            </Button>
            <span className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">
              {wonLabel(row.amount)}
            </span>
          </div>
          <p className="text-xs wrap-anywhere text-gray-500">
            {paidLabel(row.paidOn)} · {placeOf(row)}
          </p>
        </li>
      ))}
    </ul>
  )
}

// 최근 지출 3건(와이어프레임 FIN-00 '최근 지출 내역'). 줄을 누르면 그 지출이 열리고, 머리의 링크는 지출 탭이다.
export function OverviewRecent({ rows, wide, onOpen, onAll }: Props) {
  return (
    <section aria-label="최근 지출" className={cn(cardClass, 'overflow-hidden')}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">최근 지출</h3>
        <Button
          variant="link"
          size="sm"
          className={cn('h-auto p-0 text-xs text-gray-500', headLinkTouch)}
          onClick={onAll}
        >
          지출 전체 보기
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="p-4">
          <StateMessage kind="empty">지출 없음</StateMessage>
        </div>
      ) : wide ? (
        <RecentTable rows={rows} onOpen={onOpen} />
      ) : (
        <RecentList rows={rows} onOpen={onOpen} />
      )}
    </section>
  )
}
