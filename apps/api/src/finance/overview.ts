import { asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, events } from '../db/schema.ts'
import { Blocked } from '../routes.ts'
import { day } from '../time.ts'
import { budgetPlanDraft } from './budget-plan.ts'
import { won } from './labels.ts'
import {
  isCommitted,
  moneyItems,
  paidRows,
  plannedGroups,
  sumCommitted,
  sumPaid,
  type MoneyItem,
  type PaidRow,
} from './money.ts'

// 전체 재정 현황(FIN-00 · FIN-00B)의 겉면과 나눠 보기.
//
// **총예산은 수입원의 합이고 사용 가능은 총예산 − 실결제 − 아직 안 낸 승인액이다.**
// 사람이 정한 셈이다(2026-09-05, `docs/decisions/budget-screen.md`). 구매 요청 검토가
// 행사 하나에 대해 같은 셈을 들고(`requests.ts`의 `budgetAvailable`), 여기는 학생회
// 전체와 그것을 나눈 줄들에 대해 든다 — 읽는 표가 같으므로(`money.ts`) 수가 갈릴 자리가 없다.
//
// **편성 전인 학생회는 총예산이 없다.** 그때 0원을 주면 '예산이 0원이다'라는 다른 사실이
// 된다(`budgetAvailable`이 null을 '예산 미정'으로 돌리는 것과 같은 까닭). 그래서 예산에서
// 나오는 조각은 '편성 전'이라 말하고, 쓴 돈은 예산과 무관한 사실이라 그대로 센다.
//
// **집행률은 그림이 센 대로 센다.** 겉면의 두 문구는 실제 지출만의 비율과 지출 예정을 더한
// 비율로 갈려 있고(41.3% · 51.7%), 나눠 본 표의 한 줄에 있는 집행률 하나는 지출 예정을
// 포함한 값이다 — 그림이 배정 5,000,000 · 지출 2,100,000 · 예정 600,000에 54%를 그렸다.

/** 편성 전임을 말하는 글. 0원과 다른 사실이다. */
const NOT_PLANNED = '편성 전'
/**
 * 편성은 됐는데 이 줄을 가리키는 예산 항목이 없다. '편성 전'과 다른 사실이고, 검토 화면과
 * 행사 재정이 같은 사실을 부르는 말이다(`review.ts` · `events/finance.ts`).
 */
const NO_BUDGET = '예산 미정'
/** 수입의 합에서 배정의 합을 뺀 것. 사람이 정한 말이다(`docs/decisions/budget-screen.md`). */
const UNALLOCATED = '미배정'

/** 행사에 딸리지 않은 돈이 모이는 줄. 장부가 그런 지출을 부르는 말과 같다(`ledger.ts`). */
const ONGOING = { id: 'ongoing', name: '운영 (상시)' } as const
/** 담당 부서가 없는 항목(행사 항목 전부와 부서를 고르지 않은 상시 항목)이 모이는 줄. */
const UNASSIGNED = { id: 'unassigned', name: '부서 미지정' } as const

interface BudgetLine {
  id: string
  eventId: string | null
  departmentId: string | null
  amount: number
}

interface Facts {
  /** 회계 기간이 있으면 편성한 것이다. 저장이 기간을 반드시 쓰므로 이것이 편성의 표시다. */
  period: { start: string; end: string } | null
  sources: Array<{ name: string; amount: number }>
  items: BudgetLine[]
  paid: PaidRow[]
  money: MoneyItem[]
}

/**
 * 셈의 바탕. **편성 한 벌은 편성 화면이 읽는 그 함수로 읽는다**(`budgetPlanDraft`) —
 * 총예산 카드와 편성 화면의 수입 합계가 다른 줄을 보면 안 된다.
 */
async function facts(db: Db, orgId: string): Promise<Facts> {
  const [draft, paid, money] = await Promise.all([
    budgetPlanDraft(db, orgId),
    paidRows(db, orgId),
    moneyItems(db, orgId),
  ])
  return {
    period:
      draft.periodStart === undefined || draft.periodEnd === undefined
        ? null
        : { start: draft.periodStart, end: draft.periodEnd },
    sources: draft.sources.map((row) => ({ name: row.sourceName, amount: row.sourceAmount })),
    items: [
      ...draft.items.map((row) => ({
        id: row.id,
        eventId: null,
        departmentId: row.itemDepartment ?? null,
        amount: row.itemAmount,
      })),
      ...draft.eventItems.map((row) => ({
        id: row.id,
        eventId: row.eventItemEvent,
        departmentId: null,
        amount: row.eventItemAmount,
      })),
    ],
    paid,
    money,
  }
}

/** `2026-03-01` → `2026. 03. 01`. 날짜만 있는 값이라 시간대를 지나지 않는다. */
function dotted(iso: string): string {
  const [year, month, dayOfMonth] = iso.split('-')
  return `${year}. ${month}. ${dayOfMonth}`
}

/** 소수 첫째 자리까지. 그림이 41.3%로 그렸다. */
function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function percent(part: number, total: number): number {
  return total <= 0 ? 0 : (part / total) * 100
}

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

/**
 * 겉면 한 벌(`finance.orgOverview`).
 *
 * **미배정도 여기서 센다.** 수입의 합에서 배정의 합을 뺀 것이 총예산 카드의 부연에 붙는다
 * — 사람이 그렇게 정했다('넘지 않는 한 남는 금액은 미배정으로 총예산 카드에 보인다').
 */
export async function orgOverview(db: Db, orgId: string, now: Date): Promise<OrgOverview> {
  const { period, sources, items, paid, money } = await facts(db, orgId)
  const spent = sumPaid(paid)
  const planned = sumCommitted(money)
  const plannedCount = plannedGroups(money).length

  const counted = {
    // 기준일은 오늘이다 — 값이 언제 것인지를 화면이 알 길이 이것뿐이다.
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

  // 막대의 두 마디. 뒤 마디는 앞 마디에 더해지는 몫이라 둘을 더하면 예정 포함 비율이다.
  // 계약이 0-100이라 적었으므로 넘게 썼으면 막대만 끝까지 차고 문구는 실제 수를 말한다.
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
      ? {
          executionNote: '총예산이 0원이라 집행률을 셀 수 없습니다',
          plannedIncludedNote: '',
        }
      : {
          executionNote: `전체 예산 집행률 ${percent(spent, total).toFixed(1)}%`,
          plannedIncludedNote: `지출 예정 포함 ${percent(spent + planned, total).toFixed(1)}%`,
        }),
    spentPercent,
    plannedPercent,
    ...counted,
  }
}

// ── 나눠 보기 ────────────────────────────────────────────────────────────

type Scope = 'event' | 'department'

/** 축은 둘뿐이다(`finance.breakdownScope`). 다른 값은 뜻이 없으므로 막는다. */
function readScope(asked: string | undefined): Scope {
  const wanted = (asked ?? '').trim()
  if (wanted === 'event' || wanted === 'department') return wanted
  throw new Blocked('나누는 축은 행사별(event) 또는 부서별(department)이어야 합니다')
}

/** 한 줄에 모이는 돈. `budget`이 null이면 이 줄을 가리키는 예산 항목이 하나도 없다. */
interface Bucket {
  budget: number | null
  spent: number
  planned: number
}

class Buckets {
  private readonly map = new Map<string, Bucket>()

  private at(key: string): Bucket {
    const found = this.map.get(key)
    if (found !== undefined) return found
    const made: Bucket = { budget: null, spent: 0, planned: 0 }
    this.map.set(key, made)
    return made
  }

  allot(key: string, amount: number): void {
    const bucket = this.at(key)
    bucket.budget = (bucket.budget ?? 0) + amount
  }

  spend(key: string, amount: number): void {
    this.at(key).spent += amount
  }

  plan(key: string, amount: number): void {
    this.at(key).planned += amount
  }

  get(key: string): Bucket | undefined {
    return this.map.get(key)
  }
}

export interface BreakdownRow {
  id: string
  name: string
  budget: string
  spent: string
  planned: string
  available: string
  executionPercent: number
}

function rowOf(id: string, name: string, bucket: Bucket, planned: boolean): BreakdownRow {
  const drawn = { id, name, spent: won(bucket.spent), planned: won(bucket.planned) }
  // 편성 전이면 배정도 사용 가능도 없다. 0원은 다른 사실이다.
  if (!planned) return { ...drawn, budget: NOT_PLANNED, available: NOT_PLANNED, executionPercent: 0 }
  // 편성은 됐는데 이 줄에 배정된 항목이 없다. 뺄 바탕이 없으므로 수가 아니라 그 사실을 준다.
  if (bucket.budget === null) return { ...drawn, budget: NO_BUDGET, available: NO_BUDGET, executionPercent: 0 }
  return {
    ...drawn,
    budget: won(bucket.budget),
    available: won(bucket.budget - bucket.spent - bucket.planned),
    // 지출 예정을 포함한 비율이다 — 그림이 그렇게 셌다. 계약이 0-100이라 적었다.
    executionPercent: Math.min(100, Math.round(percent(bucket.spent + bucket.planned, bucket.budget))),
  }
}

/**
 * 총예산을 나눠 본 표(`finance.orgBreakdown`).
 *
 * **축이 줄의 뜻을 통째로 바꾼다.**
 *
 * - **행사별**은 요청의 행사로 선다 — `budgetAvailable`이 행사 하나를 세는 그 규칙이라
 *   줄의 사용 가능액이 검토 화면의 값과 같다. 행사에 딸리지 않은 돈은 '운영 (상시)' 한 줄이다.
 * - **부서별**은 예산 항목의 담당 부서로 선다(사람이 정함, 2026-09-05). 배정이 항목에 있으니
 *   지출도 그 항목을 가리키는 품목으로 따라간다 — 요청한 부서로 세면 배정과 지출이 다른
 *   부서에 놓여 사용 가능액이 뜻을 잃는다. 결제 하나의 품목이 여러 부서의 항목을 가리키면
 *   어느 부서의 돈인지 갈라 셀 사실이 없으므로 '부서 미지정'에 둔다 — 나누는 규칙을
 *   지어내지 않는다. 행사 항목은 담당 부서가 없어 그 돈이 전부 '부서 미지정'에 모인다.
 *
 * 어느 축이든 학생회의 돈을 다 덮는다 — 한 축에서 사라지는 돈이 없다.
 */
export async function orgBreakdown(db: Db, orgId: string, scope: string | undefined): Promise<BreakdownRow[]> {
  const axis = readScope(scope)
  const { period, items, paid, money } = await facts(db, orgId)
  const planned = period !== null
  const buckets = new Buckets()

  if (axis === 'event') {
    for (const item of items) buckets.allot(item.eventId ?? ONGOING.id, item.amount)
    for (const row of paid) buckets.spend(row.eventId ?? ONGOING.id, row.paidAmount)
    for (const item of money) {
      if (isCommitted(item)) buckets.plan(item.eventId ?? ONGOING.id, item.approvedAmount)
    }
    const rows = await db
      .select({ id: events.id, title: events.title })
      .from(events)
      .where(eq(events.orgId, orgId))
      // 이른 행사가 먼저. 편성 화면의 행사 고르기와 같은 차례다.
      .orderBy(asc(events.startAt), asc(events.title), asc(events.id))
    const drawn: BreakdownRow[] = []
    for (const event of rows) {
      const bucket = buckets.get(event.id)
      if (bucket !== undefined) drawn.push(rowOf(event.id, event.title, bucket, planned))
    }
    const ongoing = buckets.get(ONGOING.id)
    if (ongoing !== undefined) drawn.push(rowOf(ONGOING.id, ONGOING.name, ongoing, planned))
    return drawn
  }

  for (const item of items) buckets.allot(item.departmentId ?? UNASSIGNED.id, item.amount)
  for (const item of money) {
    if (isCommitted(item)) buckets.plan(item.budgetDepartmentId ?? UNASSIGNED.id, item.approvedAmount)
  }
  // 결제의 부서는 그 결제에 딸린 품목들이 가리키는 항목의 담당 부서다. 하나로 모이면 그
  // 부서이고, 없거나 갈리면 '부서 미지정'이다.
  const departmentsOfPayment = new Map<string, Set<string | null>>()
  for (const item of money) {
    if (item.paymentId === null) continue
    const found = departmentsOfPayment.get(item.paymentId) ?? new Set<string | null>()
    found.add(item.budgetDepartmentId)
    departmentsOfPayment.set(item.paymentId, found)
  }
  for (const row of paid) {
    const found = departmentsOfPayment.get(row.paymentId)
    const only = found !== undefined && found.size === 1 ? [...found][0]! : null
    buckets.spend(only ?? UNASSIGNED.id, row.paidAmount)
  }
  const rows = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.orgId, orgId))
    // 조직도가 그리는 차례다 — 이름순이 아니다.
    .orderBy(asc(departments.sortOrder), asc(departments.name), asc(departments.id))
  const drawn: BreakdownRow[] = []
  for (const department of rows) {
    const bucket = buckets.get(department.id)
    if (bucket !== undefined) drawn.push(rowOf(department.id, department.name, bucket, planned))
  }
  const unassigned = buckets.get(UNASSIGNED.id)
  if (unassigned !== undefined) drawn.push(rowOf(UNASSIGNED.id, UNASSIGNED.name, unassigned, planned))
  return drawn
}
