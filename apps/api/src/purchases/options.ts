import { and, asc, eq } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { budgetItems } from '../db/schema.ts'
import { Blocked } from '../routes.ts'

// 구매 요청이 고르는 것들.
//
// **품목 카테고리·구매 유형·우선순위는 명세가 값을 든다**(2026-09-06에 사람이 정했다 —
// 조직이 정하는 화면이 없어 서버에 미뤄 두었더니 그 사이 구매 요청을 아무도 못 썼다). 표에는
// 그 **코드**(`supplies`·`online`·`normal`)가 담기고 사람이 읽는 말은 명세에만 있다 — 여기서
// 다시 적으면 두 벌이 갈린다.
//
// **예산 항목만 저장소에서 온다.** 그 행사의 예산이라 행사마다 다르다(FIN-PLAN-01이 채운다).

function staticLabels(key: string): Map<string, string> {
  const source = optionSourcesJson.sources.find((one) => one.key === key) as
    | { type: string; options?: Array<{ value: string; label: string }> }
    | undefined
  // 없으면 서버가 뜰 때 멈춘다 — 없는 목록에 맞춰 값을 거르면 모든 값이 막힌다.
  if (source === undefined || source.type !== 'static' || source.options === undefined) {
    throw new Error(`계약에 '${key}'의 고정 목록이 없습니다.`)
  }
  return new Map(source.options.map((option) => [option.value, option.label]))
}

export const ITEM_CATEGORIES = staticLabels('finance.itemCategories')
export const PURCHASE_TYPES = staticLabels('finance.purchaseTypes')
export const REQUEST_PRIORITIES = staticLabels('finance.requestPriorities')
export const QUOTE_STATUSES = staticLabels('finance.quoteStatus')
export const REVIEW_RESULTS = staticLabels('finance.reviewResults')

/**
 * 코드인지 확인한다. **목록에 없으면 막는다** — 글('소모품')을 값으로 담으면 화면이 그것을
 * 무슨 말로 부를지 다시 물어야 하고, 말을 다듬는 날 담긴 값이 옛 말을 든 채 굳는다
 * (판정 값을 한글로 담았다가 걷어낸 전례).
 */
export function codeOf(labels: Map<string, string>, value: string | null, label: string): string | null {
  if (value === null) return null
  if (!labels.has(value)) throw new Blocked(`${label}에 그런 값이 없습니다: ${value}`)
  return value
}

/** 코드를 사람이 읽는 말로. 목록에 없는 코드(옛 값)는 그대로 보인다 — 숨기지 않는다. */
export function labelOf(labels: Map<string, string>, code: string | null): string | null {
  return code === null ? null : (labels.get(code) ?? code)
}

export interface BudgetItemOption {
  value: string
  label: string
}

/**
 * 그 행사의 예산 항목(`finance.budgetItems.options`). 편성한 차례대로 온다.
 *
 * 값은 항목의 id다 — 요청의 품목이 어느 항목에 딸렸는지를 id로 담는다(`budgetItemId`).
 */
export async function budgetItemOptions(db: Db, orgId: string, eventId: string): Promise<BudgetItemOption[]> {
  const rows = await db
    .select({ id: budgetItems.id, name: budgetItems.name })
    .from(budgetItems)
    .where(and(eq(budgetItems.orgId, orgId), eq(budgetItems.eventId, eventId)))
    .orderBy(asc(budgetItems.sortOrder), asc(budgetItems.id))
  return rows.map((row) => ({ value: row.id, label: row.name }))
}
