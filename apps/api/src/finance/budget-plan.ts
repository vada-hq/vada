import { and, asc, eq, inArray, ne, notInArray } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { budgetItems, budgetPeriods, budgetSources, departments, events } from '../db/schema.ts'
import { Blocked } from '../routes.ts'
import { won } from './labels.ts'

// 예산 편성(FIN-PLAN-01) — 읽기 하나 · 행사 고르기 하나 · 저장 하나.
//
// **재정 28자리가 전부 이 화면이 넣는 금액 위에 선다.** 총예산은 수입원의 합이고,
// 상시 항목과 행사별 항목이 그것을 나눠 갖는다. 표 셋이 한 벌이다 —
// `budget_periods`(학생회에 하나) · `budget_sources` · `budget_items`(행사에 딸리면
// 행사별, 아니면 상시).
//
// **저장은 덮어쓰기다**(계약 `repeat: overwrite`). 화면이 한 벌 전부를 보내므로
// 안 보낸 줄은 지운 것이다 — 조직도 저장(`org/chart-save.ts`)과 같은 뜻이다.
// 배정의 합이 수입의 합을 넘으면 막는다(422). 남는 금액은 미배정이고 그것은 읽는
// 자리(`finance.orgOverview`)가 센다.

type Row = Record<string, unknown>

/** 행사 단계를 사람이 읽는 말로. 명세의 고정 목록(`event.status`)에서 읽는다. */
const STAGE_LABEL = new Map<string, string>(
  (
    optionSourcesJson.sources.find((source) => source.key === 'event.status') as
      | { options: Array<{ value: string; label: string }> }
      | undefined
  )?.options.map((option) => [option.value, option.label]) ?? [],
)

// ── 읽기 ────────────────────────────────────────────────────────────────

export interface BudgetSourceDraft {
  id: string
  sourceName: string
  sourceAmount: number
}

export interface BudgetItemDraft {
  id: string
  itemName: string
  itemAmount: number
  itemDepartment?: string
}

export interface BudgetEventItemDraft {
  id: string
  eventItemEvent: string
  eventItemName: string
  eventItemAmount: number
}

export interface BudgetPlanDraft {
  periodStart?: string
  periodEnd?: string
  sources: BudgetSourceDraft[]
  items: BudgetItemDraft[]
  eventItems: BudgetEventItemDraft[]
}

/**
 * 학생회의 편성 한 벌. **아직 아무것도 안 정한 학생회는 기간도 줄도 없이 온다** —
 * 조각을 비워 내지 않고 아예 내지 않는다. 그것이 갓 만든 학생회의 첫 모습이다.
 *
 * 금액은 **수**로 준다. 자릿점은 화면이 붙인다 — 화면이 합계를 다시 셈해야 하는
 * 자리라(`compute: sum`) 글로 주면 화면이 글을 수로 되돌려야 한다.
 */
export async function budgetPlanDraft(db: Db, orgId: string): Promise<BudgetPlanDraft> {
  const [period] = await db
    .select({ startsOn: budgetPeriods.startsOn, endsOn: budgetPeriods.endsOn })
    .from(budgetPeriods)
    .where(eq(budgetPeriods.orgId, orgId))
    .limit(1)
  const sources = await db
    .select({ id: budgetSources.id, name: budgetSources.name, amount: budgetSources.amount })
    .from(budgetSources)
    .where(eq(budgetSources.orgId, orgId))
    .orderBy(asc(budgetSources.sortOrder), asc(budgetSources.id))
  const items = await db
    .select({
      id: budgetItems.id,
      eventId: budgetItems.eventId,
      name: budgetItems.name,
      amount: budgetItems.amount,
      departmentId: budgetItems.departmentId,
    })
    .from(budgetItems)
    .where(eq(budgetItems.orgId, orgId))
    .orderBy(asc(budgetItems.sortOrder), asc(budgetItems.id))

  return {
    ...(period === undefined ? {} : { periodStart: period.startsOn, periodEnd: period.endsOn }),
    sources: sources.map((row) => ({ id: row.id, sourceName: row.name, sourceAmount: row.amount })),
    items: items
      .filter((row) => row.eventId === null)
      .map((row) => ({
        id: row.id,
        itemName: row.name,
        itemAmount: row.amount,
        ...(row.departmentId === null ? {} : { itemDepartment: row.departmentId }),
      })),
    eventItems: items
      .filter((row): row is typeof row & { eventId: string } => row.eventId !== null)
      .map((row) => ({
        id: row.id,
        eventItemEvent: row.eventId,
        eventItemName: row.name,
        eventItemAmount: row.amount,
      })),
  }
}

export interface BudgetEventOption {
  value: string
  label: string
  description?: string
}

/**
 * 예산을 배정할 수 있는 행사. **완료된 행사는 오지 않는다** — 끝난 행사에 예산을
 * 새로 배정할 일이 없다. 행사에는 '취소'라는 단계가 없어(회의에만 있다) 빠지는 것은
 * `done` 하나다. 단계가 곁에 붙는다(description).
 */
export async function budgetEventOptions(db: Db, orgId: string): Promise<BudgetEventOption[]> {
  const rows = await db
    .select({ id: events.id, title: events.title, status: events.status })
    .from(events)
    .where(and(eq(events.orgId, orgId), ne(events.status, 'done')))
    .orderBy(asc(events.startAt), asc(events.title), asc(events.id))
  return rows.map((row) => {
    const stage = STAGE_LABEL.get(row.status)
    return { value: row.id, label: row.title, ...(stage === undefined ? {} : { description: stage }) }
  })
}

// ── 저장 ────────────────────────────────────────────────────────────────

/** 화면이 초안에 줄 이름을 이어 담는 글자(`spec/compute.ts`의 joinRowIds). */
const ROW_SEPARATOR = '\n'
const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * 목록 하나의 줄들.
 *
 * **두 꼴로 온다.** 화면은 초안을 그대로 보내므로 목록 칸에는 줄 이름이 줄바꿈으로
 * 이어져 있고 줄의 칸은 `목록.줄.칸`에 있다(`payloadScope: budgetPlanDraft`). 계약이
 * 적은 모양(OpenAPI)은 줄의 배열이다. 어느 쪽이든 같은 뜻으로 읽되 **모르는 모양은
 * 막는다.**
 */
function rowsOf(draft: Row, listKey: string, label: string): Row[] {
  const slot = draft[listKey]
  if (slot === undefined || slot === null || slot === '') return []
  if (Array.isArray(slot)) {
    return slot.map((row, index) => {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        throw new Blocked(`${label} ${index + 1}번째 줄의 모양이 아닙니다`)
      }
      return row as Row
    })
  }
  if (typeof slot !== 'string') throw new Blocked(`${label} 목록의 모양이 아닙니다`)
  return slot
    .split(ROW_SEPARATOR)
    .map((rowId) => rowId.trim())
    .filter((rowId) => rowId !== '')
    .map((rowId) => {
      const prefix = `${listKey}.${rowId}.`
      const row: Row = {}
      for (const [key, value] of Object.entries(draft)) {
        if (key.startsWith(prefix)) row[key.slice(prefix.length)] = value
      }
      return row
    })
}

/** 글 칸 하나. 빈 글은 없는 것이다. */
function readWord(row: Row, key: string, label: string): string | null {
  const value = row[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Blocked(`${label} 칸은 글로 적어 주세요`)
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function requiredWord(row: Row, key: string, label: string): string {
  const word = readWord(row, key, label)
  if (word === null) throw new Blocked(`${label} 칸이 비어 있습니다`)
  return word
}

/**
 * 금액. **0 이상의 정수다** — 표가 정수이고 원 아래 단위가 없다. 화면은 수를 글로
 * 실어 보내고(초안은 글의 맵이다) 계약은 수라 적었으므로 둘 다 받는다. 자릿점이 찍힌
 * 글도 수다 — 사람이 적은 그대로 온 것이지 다른 값이 아니다.
 */
function readAmount(row: Row, key: string, label: string): number {
  const value = row[key]
  if (value === null || value === undefined || value === '') {
    throw new Blocked(`${label} 칸이 비어 있습니다`)
  }
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/,/g, '').trim())
        : Number.NaN
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Blocked(`${label} 칸은 0 이상의 정수여야 합니다`)
  }
  return parsed
}

/** 날짜. `YYYY-MM-DD`이고 달력에 있는 날이어야 한다(2월 30일은 날이 아니다). */
function readDay(draft: Row, key: string, label: string): string {
  const word = requiredWord(draft, key, label)
  const real = new Date(`${word}T00:00:00Z`)
  if (!DAY.test(word) || Number.isNaN(real.getTime()) || real.toISOString().slice(0, 10) !== word) {
    throw new Blocked(`${label} 칸은 YYYY-MM-DD 꼴의 날짜여야 합니다`)
  }
  return word
}

interface SourceRow {
  id: string | null
  name: string
  amount: number
}

interface ItemRow {
  id: string | null
  eventId: string | null
  name: string
  amount: number
  departmentId: string | null
}

/** 같은 줄이 두 번 오면 하나로 합쳐지며 다른 하나가 조용히 사라진다. 막는다. */
function noDuplicateIds(rows: Array<{ id: string | null }>, label: string): void {
  const seen = new Set<string>()
  for (const row of rows) {
    if (row.id === null) continue
    if (seen.has(row.id)) throw new Blocked(`${label}에 같은 줄이 두 번 왔습니다`)
    seen.add(row.id)
  }
}

/**
 * 편성 한 벌을 저장한다(`finance.budgetPlan.save`).
 *
 * **덮어쓰기다.** id가 온 줄은 고치고, 없는 줄은 만들고, 안 온 줄은 지운다. 그래서
 * 받는 것은 '무엇이 바뀌었나'가 아니라 **지금 편성이 어떤 모양인가**이고, 저장이 끝나면
 * 저장소가 그 모양이 된다.
 *
 * **막는 것 넷**(전부 422): 시작일이 끝일보다 늦다 · 배정의 합이 수입의 합을 넘는다 ·
 * 이 학생회에 없는 부서·행사 · 이 학생회에 없는 줄 id(남의 학생회 줄을 들고 와도
 * 같다 — 조용히 새 줄로 만들지 않는다).
 *
 * **한 번에 다 바뀌거나 하나도 안 바뀐다.** 반쯤 저장된 편성은 어느 화면도 설명하지
 * 못한다 — 총예산 카드가 수입은 새것을, 배정은 옛것을 보게 된다.
 */
export async function saveBudgetPlan(
  db: Db,
  orgId: string,
  body: unknown,
  newId: () => string,
  now: Date,
): Promise<Record<string, never>> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new Blocked('예산 편성 한 벌의 모양이 아닙니다')
  }
  const draft = body as Row

  const startsOn = readDay(draft, 'periodStart', '시작일')
  const endsOn = readDay(draft, 'periodEnd', '끝일')
  if (startsOn > endsOn) throw new Blocked('시작일이 끝일보다 늦습니다')

  const sources: SourceRow[] = rowsOf(draft, 'sources', '수입원').map((row) => ({
    id: readWord(row, 'id', '수입원 줄'),
    name: requiredWord(row, 'sourceName', '수입원 이름'),
    amount: readAmount(row, 'sourceAmount', '수입원 금액'),
  }))
  const items: ItemRow[] = rowsOf(draft, 'items', '상시 예산 항목').map((row) => ({
    id: readWord(row, 'id', '항목 줄'),
    eventId: null,
    name: requiredWord(row, 'itemName', '항목 이름'),
    amount: readAmount(row, 'itemAmount', '항목 배정액'),
    departmentId: readWord(row, 'itemDepartment', '담당 부서'),
  }))
  const eventItems: ItemRow[] = rowsOf(draft, 'eventItems', '행사별 예산 항목').map((row) => ({
    id: readWord(row, 'id', '행사 항목 줄'),
    eventId: requiredWord(row, 'eventItemEvent', '행사'),
    name: requiredWord(row, 'eventItemName', '행사 항목 이름'),
    amount: readAmount(row, 'eventItemAmount', '행사 항목 배정액'),
    departmentId: null,
  }))
  noDuplicateIds(sources, '수입원')
  noDuplicateIds([...items, ...eventItems], '예산 항목')

  // **총예산은 수입의 합이고 배정은 그것을 넘지 못한다.** 넘지 않는 한 남는 것은 미배정이다.
  const income = sources.reduce((sum, row) => sum + row.amount, 0)
  const allotted = [...items, ...eventItems].reduce((sum, row) => sum + row.amount, 0)
  if (allotted > income) {
    throw new Blocked(`배정 합계 ${won(allotted)}이 수입 합계 ${won(income)}을 넘습니다`)
  }

  // **남의 학생회 부서·행사에 우리 예산을 걸지 못한다.** 표도 막지만(복합 외래 키)
  // 여기서 먼저 막아야 '받을 수 없는 값'(422)이지 서버의 고장이 아니다.
  const wantedDepartments = [...new Set(items.map((row) => row.departmentId).filter((id): id is string => id !== null))]
  if (wantedDepartments.length > 0) {
    const ours = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.orgId, orgId), inArray(departments.id, wantedDepartments)))
    const known = new Set(ours.map((row) => row.id))
    if (wantedDepartments.some((id) => !known.has(id))) throw new Blocked('이 학생회에 없는 부서입니다')
  }
  const wantedEvents = [...new Set(eventItems.map((row) => row.eventId as string))]
  if (wantedEvents.length > 0) {
    const ours = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.orgId, orgId), inArray(events.id, wantedEvents)))
    const known = new Set(ours.map((row) => row.id))
    if (wantedEvents.some((id) => !known.has(id))) throw new Blocked('이 학생회에 없는 행사입니다')
  }

  await db.transaction(async (tx) => {
    // 기간 — 학생회에 하나. 있으면 고치고 없으면 만든다.
    const [period] = await tx
      .select({ id: budgetPeriods.id })
      .from(budgetPeriods)
      .where(eq(budgetPeriods.orgId, orgId))
      .limit(1)
    if (period === undefined) {
      await tx.insert(budgetPeriods).values({ id: newId(), orgId, startsOn, endsOn, updatedAt: now })
    } else {
      await tx
        .update(budgetPeriods)
        .set({ startsOn, endsOn, updatedAt: now })
        .where(and(eq(budgetPeriods.orgId, orgId), eq(budgetPeriods.id, period.id)))
    }

    // 수입원.
    const knownSources = new Set(
      (
        await tx.select({ id: budgetSources.id }).from(budgetSources).where(eq(budgetSources.orgId, orgId))
      ).map((row) => row.id),
    )
    const keptSources: string[] = []
    for (const [sortOrder, row] of sources.entries()) {
      if (row.id === null) {
        const id = newId()
        await tx.insert(budgetSources).values({ id, orgId, name: row.name, amount: row.amount, sortOrder })
        keptSources.push(id)
        continue
      }
      if (!knownSources.has(row.id)) throw new Blocked('이 학생회에 없는 수입원 줄입니다')
      await tx
        .update(budgetSources)
        .set({ name: row.name, amount: row.amount, sortOrder })
        .where(and(eq(budgetSources.orgId, orgId), eq(budgetSources.id, row.id)))
      keptSources.push(row.id)
    }
    await tx
      .delete(budgetSources)
      .where(
        keptSources.length === 0
          ? eq(budgetSources.orgId, orgId)
          : and(eq(budgetSources.orgId, orgId), notInArray(budgetSources.id, keptSources)),
      )

    // 예산 항목 — 상시와 행사별이 한 표다. 무엇에 딸렸느냐만 다르다.
    const knownItems = new Set(
      (await tx.select({ id: budgetItems.id }).from(budgetItems).where(eq(budgetItems.orgId, orgId))).map(
        (row) => row.id,
      ),
    )
    const keptItems: string[] = []
    for (const [sortOrder, row] of [...items, ...eventItems].entries()) {
      const values = {
        name: row.name,
        amount: row.amount,
        eventId: row.eventId,
        departmentId: row.departmentId,
        sortOrder,
      }
      if (row.id === null) {
        const id = newId()
        await tx.insert(budgetItems).values({ id, orgId, ...values })
        keptItems.push(id)
        continue
      }
      if (!knownItems.has(row.id)) throw new Blocked('이 학생회에 없는 예산 항목 줄입니다')
      await tx
        .update(budgetItems)
        .set(values)
        .where(and(eq(budgetItems.orgId, orgId), eq(budgetItems.id, row.id)))
      keptItems.push(row.id)
    }
    // 지워진 항목을 가리키던 구매 품목·장부 줄은 가리키는 곳만 비운다(외래 키가 set null).
    await tx
      .delete(budgetItems)
      .where(
        keptItems.length === 0
          ? eq(budgetItems.orgId, orgId)
          : and(eq(budgetItems.orgId, orgId), notInArray(budgetItems.id, keptItems)),
      )
  })

  return {}
}
