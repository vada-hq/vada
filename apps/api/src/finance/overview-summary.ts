import type { Db } from '../db/client.ts'
import { day } from '../time.ts'
import { won } from './labels.ts'
import { plannedGroups, sumCommitted, sumPaid } from './money.ts'
import { financeOverviewFacts, NOT_PLANNED, percent, UNALLOCATED } from './overview-facts.ts'

export interface OrgOverview {
  termNote: string
  asOfNote: string
  totalBudget: string
  totalBudgetNote: string
  spent: string
  spentNote: string
  planned: string
  plannedNote: string
  available: string
  availableNote: string
  executionNote: string
  plannedIncludedNote: string
  spentPercent: number
  plannedPercent: number
}

export async function orgOverview(db: Db, orgId: string, now: Date): Promise<OrgOverview> {
  const { period, sources, items, paid, money } = await financeOverviewFacts(db, orgId)
  const spent = sumPaid(paid)
  const planned = sumCommitted(money)
  const plannedCount = plannedGroups(money).length
  const counted = {
    asOfNote: `${day(now).replace(/ /g, '')} 기준`,
    spent: won(spent),
    spentNote: `결제가 완료된 ${paid.length}건`,
    planned: won(planned),
    plannedNote: `결제 예정 ${plannedCount}건`,
  }
  if (period === null) {
    return {
      termNote: NOT_PLANNED,
      totalBudget: NOT_PLANNED,
      totalBudgetNote: '아직 예산을 편성하지 않았습니다',
      available: NOT_PLANNED,
      availableNote: '예산을 편성하면 셉니다',
      executionNote: '예산을 편성하면 집행률이 보입니다',
      plannedIncludedNote: '',
      spentPercent: 0,
      plannedPercent: 0,
      ...counted,
    }
  }
  const total = sources.reduce((sum, row) => sum + row.amount, 0)
  const allotted = items.reduce((sum, row) => sum + row.amount, 0)
  const unallocated = total - allotted
  const first = sources[0]
  const sourceNote =
    first === undefined
      ? '수입원 없음'
      : sources.length === 1
        ? first.name
        : `${first.name} 외 ${sources.length - 1}건`
  const spentPercent = Math.min(100, round1(percent(spent, total)))
  const included = Math.min(100, round1(percent(spent + planned, total)))
  const plannedPercent = Math.max(0, round1(included - spentPercent))
  return {
    termNote: `${dotted(period.start)} – ${dotted(period.end)}`,
    totalBudget: won(total),
    totalBudgetNote: unallocated > 0 ? `${sourceNote} · ${UNALLOCATED} ${won(unallocated)}` : sourceNote,
    available: won(total - spent - planned),
    availableNote: '새로 사용할 수 있는 금액',
    ...(total <= 0
      ? { executionNote: '총예산이 0원이라 집행률을 셀 수 없습니다', plannedIncludedNote: '' }
      : {
          executionNote: `전체 예산 집행률 ${percent(spent, total).toFixed(1)}%`,
          plannedIncludedNote: `지출 예정 포함 ${percent(spent + planned, total).toFixed(1)}%`,
        }),
    spentPercent,
    plannedPercent,
    ...counted,
  }
}

function dotted(iso: string): string {
  const [year, month, dayOfMonth] = iso.split('-')
  return `${year}. ${month}. ${dayOfMonth}`
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
