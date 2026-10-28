import type { FinanceTab } from '@vada/contracts'
import type { PageTrail } from '@/components/PageHeading'

export const FINANCE_TITLE = '재정'
export const FINANCE_TAB_LABELS = {
  overview: '예산 현황',
  ledger: '사용 내역',
  closing: '결산',
} as const

export function financeTrail(tab: FinanceTab): PageTrail {
  return {
    title: FINANCE_TITLE,
    crumbs: tab === 'accounts' ? [] : [{ label: FINANCE_TAB_LABELS[tab], truncate: false }],
  }
}

export const CLOSING_SECTION_NAV_LABEL = '결산 구역'
export const CLOSING_SECTIONS = {
  events: { id: 'finance-event-settlements', label: '행사 정산' },
  period: { id: 'finance-period-closing', label: '기간 결산' },
} as const
