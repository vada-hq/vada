import type { BudgetItemVersion } from '@vada/contracts'
import { monthDayTime } from '@/lib/korean-date-text'
import { wonLabel } from './purchase-view'

const UNKNOWN_PERSON = '알 수 없는 사람'

// 예산 항목 이력의 한 줄(DEC-34): '이름 · 10월 25일 (일) 14:00 · 금액 300,000원 → 250,000원 · 사유: 줄임'.
// 첫 판은 만든 이름과 금액이고, 뒤 판은 앞 판과 견주어 바뀐 칸(이름, 금액)의 이전·이후와 고칠 때 받은 사유다.
function changesOf(version: BudgetItemVersion, before: BudgetItemVersion | undefined) {
  if (!before) return [`만듦 · ${version.purpose} ${wonLabel(version.amount)}`]
  const changes: string[] = []
  if (version.purpose !== before.purpose)
    changes.push(`이름 ${before.purpose} → ${version.purpose}`)
  if (version.amount !== before.amount)
    changes.push(`금액 ${wonLabel(before.amount)} → ${wonLabel(version.amount)}`)
  if (version.reason) changes.push(`사유: ${version.reason}`)
  return changes
}

export const budgetHistoryLines = (history: readonly BudgetItemVersion[]) =>
  history.map((version, index) => ({
    versionNo: version.versionNo,
    text: [
      version.by?.name ?? UNKNOWN_PERSON,
      monthDayTime(version.at),
      ...changesOf(version, history[index - 1]),
    ].join(' · '),
  }))
