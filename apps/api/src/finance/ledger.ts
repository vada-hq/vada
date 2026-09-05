import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  budgetItems,
  departments,
  events,
  paymentDocuments,
  purchaseRequests,
} from '../db/schema.ts'
import { whoCanNote } from '../events/ending.ts'
import { shortDay } from '../ops/calendar.ts'
import { Blocked } from '../routes.ts'
import { moment } from '../time.ts'
import { BLANK, won, type PurchaseStage, type Tone } from './labels.ts'
import { moneyItems, paidRows, plannedGroups, type MoneyItem } from './money.ts'

// 사용 내역(FIN-LEDGER-01)과 전체 재정의 최근 지출·증빙 현황(FIN-00).
//
// **장부 줄은 결제와 아직 안 낸 승인에서 읽는다.** `ledger_entries`에 줄을 넣는 쓰기는
// 아직 정하지 않았고(백로그: '장부에 줄이 어떻게 드나'), 그 표는 쓴 날이 있는 줄만 담아
// 계약이 요구하는 '지출 예정'(`stage=planned`)을 담을 수 없다. 전체 재정의 '실제 지출'과
// '지출 예정'이 각각 그 단계만 보여 달라고 이 장부에 오므로, 장부는 그 두 값이 나오는 곳
// — 결제(`payments`)와 결제에 딸리지 않은 승인액 — 을 읽어야 카드와 그 '내역'이 같은
// 돈을 말한다. **`ledger_entries`는 읽지 않는다.** 두 표를 섞으면 같은 돈이 두 번 보인다;
// 요청을 거치지 않은 상시 지출이 그 표에 들어오는 날, 요청에서 온 줄(`purchaseRequestId`)을
// 빼고 잇는 일은 여기 한 곳에서 한다.
//
// **결제 하나가 줄 하나, 예정은 요청 하나가 줄 하나다.** 결제가 요청의 품목을 묶어 나가듯
// 예정도 그 단위로 묶인다 — 그림의 '케이블 커버 6m 외 1건'이 그 묶음의 이름이다.
//
// **거르는 것도 자르는 것도 세는 것도 서버가 한다.** 목록은 잘려서 오고 몇 건 중 몇 건인지는
// 범위 줄이 말한다 — 거르는 조건이 같아야 같은 것을 세므로 둘이 한 함수에서 나온다.

/** 장부 화면에 얹는 줄 수. 범위 줄이 '총 N건 중 최근 10건 표시'라 말한다. */
const PER_VIEW = 10
/** 전체 재정의 겉면에 얹는 최근 지출 줄 수. 몇 줄을 얹을지는 서버가 정한다(계약). */
const RECENT = 5

/** 행사에 딸리지 않은 지출을 부르는 말. 계약이 예로 든 그대로다. */
const ONGOING = '운영 (상시)'

/**
 * 증빙 상태의 말. **사실에서 나온다** — 서류가 비었으면 누락, 다 붙었고 처리가 끝났으면
 * 완료, 다 붙었는데 아직 처리 중이면 확인 중. 사람이 사용 내역 쪽의 말로 통일했다
 * (`docs/decisions/product-decisions.md`).
 */
const PROOF = {
  done: { label: '완료', tone: 'green' },
  checking: { label: '확인 중', tone: 'yellow' },
  missing: { label: '누락', tone: 'red' },
} as const satisfies Record<string, Tone>
/** 아직 안 낸 돈에는 붙일 증빙이 없다. */
const BEFORE_PAYMENT: Tone = { label: '결제 전', tone: 'gray' }

type ProofKey = keyof typeof PROOF

function proofOf(missingDocuments: number, stage: PurchaseStage): ProofKey {
  if (missingDocuments > 0) return 'missing'
  return stage === 'settled' ? 'done' : 'checking'
}

/** 결제 단계의 말. 화면에 갈피가 없어 범위 줄이 이것으로 무엇을 보는지 말한다. */
const STAGE_NOTE: Record<Stage, string> = { spent: '결제 완료', planned: '결제 예정' }

type Stage = 'spent' | 'planned'

interface Line {
  id: string
  stage: Stage
  requestId: string
  /** 쓴 날. 예정에는 없다. */
  when: Date | null
  /** 쓴 날의 달(`YYYY-MM`, 한국 시간). 거르는 열쇠다. */
  month: string | null
  /** 예정 줄을 줄 세우는 데 쓴다 — 낸 차례의 역순. */
  submittedAt: Date | null
  title: string
  eventId: string | null
  context: string
  departmentId: string | null
  department: string
  budgetItemIds: string[]
  budgetItem: string
  amount: number
  proof: Tone
}

interface RequestRow {
  id: string
  title: string
  eventId: string | null
  departmentId: string | null
  stage: PurchaseStage
  submittedAt: Date | null
  eventName: string | null
  departmentName: string | null
}

async function requestRows(db: Db, orgId: string): Promise<Map<string, RequestRow>> {
  const rows = (await db
    .select({
      id: purchaseRequests.id,
      title: purchaseRequests.title,
      eventId: purchaseRequests.eventId,
      departmentId: purchaseRequests.departmentId,
      stage: purchaseRequests.stage,
      submittedAt: purchaseRequests.submittedAt,
      eventName: events.title,
      departmentName: departments.name,
    })
    .from(purchaseRequests)
    // 이어 붙인 표도 자기 조직을 확인한다(`requests.ts`와 같다).
    .leftJoin(events, and(eq(purchaseRequests.eventId, events.id), eq(events.orgId, orgId)))
    .leftJoin(
      departments,
      and(eq(purchaseRequests.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(eq(purchaseRequests.orgId, orgId))) as RequestRow[]
  return new Map(rows.map((row) => [row.id, row]))
}

/** 결제마다 아직 안 붙은 서류가 몇인가. */
async function missingDocumentsByPayment(db: Db, orgId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ paymentId: paymentDocuments.paymentId, registeredAt: paymentDocuments.registeredAt })
    .from(paymentDocuments)
    .where(eq(paymentDocuments.orgId, orgId))
  const missing = new Map<string, number>()
  for (const row of rows) {
    if (row.registeredAt !== null) continue
    missing.set(row.paymentId, (missing.get(row.paymentId) ?? 0) + 1)
  }
  return missing
}

/** '천막 대여 외 1건' — 묶음의 이름은 첫 것에 나머지 수를 붙인 것이다. */
function bundled(names: readonly string[]): string | null {
  const first = names[0]
  if (first === undefined) return null
  return names.length === 1 ? first : `${first} 외 ${names.length - 1}건`
}

function distinct(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))]
}

function byTimeDesc(a: Date | null, b: Date | null): number {
  // 없는 때는 뒤로.
  if (a === null || b === null) return a === null && b === null ? 0 : a === null ? 1 : -1
  return b.getTime() - a.getTime()
}

/** 이 학생회의 장부 전부. 예정이 먼저(낸 차례의 역순), 그다음 결제가 최근 순이다. */
async function lines(db: Db, orgId: string): Promise<Line[]> {
  const [requests, paid, money, missing] = await Promise.all([
    requestRows(db, orgId),
    paidRows(db, orgId),
    moneyItems(db, orgId),
    missingDocumentsByPayment(db, orgId),
  ])

  const itemsOfPayment = new Map<string, MoneyItem[]>()
  for (const item of money) {
    if (item.paymentId === null) continue
    const found = itemsOfPayment.get(item.paymentId) ?? []
    found.push(item)
    itemsOfPayment.set(item.paymentId, found)
  }

  const shared = (request: RequestRow, items: readonly MoneyItem[]) => ({
    requestId: request.id,
    submittedAt: request.submittedAt,
    // 품목이 하나도 안 딸린 결제는 요청의 제목으로 부른다.
    title: bundled(items.map((item) => item.name)) ?? request.title,
    eventId: request.eventId,
    context: request.eventName ?? ONGOING,
    departmentId: request.departmentId,
    department: request.departmentName ?? '부서 미정',
    budgetItemIds: distinct(items.map((item) => item.budgetItemId)),
    budgetItem: bundled(distinct(items.map((item) => item.budgetItemName))) ?? '항목 미정',
  })

  const spent: Line[] = []
  for (const row of paid) {
    const request = requests.get(row.requestId)
    if (request === undefined) continue
    const items = itemsOfPayment.get(row.paymentId) ?? []
    spent.push({
      id: row.paymentId,
      stage: 'spent',
      when: row.paidOn,
      month: row.paidOn === null ? null : moment(row.paidOn).slice(0, 7),
      amount: row.paidAmount,
      proof: PROOF[proofOf(missing.get(row.paymentId) ?? 0, request.stage)],
      ...shared(request, items),
    })
  }
  spent.sort((a, b) => byTimeDesc(a.when, b.when) || a.id.localeCompare(b.id))

  const planned: Line[] = []
  for (const group of plannedGroups(money)) {
    const request = requests.get(group.requestId)
    if (request === undefined) continue
    planned.push({
      // 결제와 다른 이름 공간이다 — 같은 요청에 결제 줄과 예정 줄이 함께 있을 수 있다.
      id: `planned:${group.requestId}`,
      stage: 'planned',
      when: null,
      month: null,
      amount: group.amount,
      proof: BEFORE_PAYMENT,
      ...shared(request, group.items),
    })
  }
  planned.sort((a, b) => byTimeDesc(a.submittedAt, b.submittedAt) || a.id.localeCompare(b.id))

  return [...planned, ...spent]
}

// ── 거르기 ───────────────────────────────────────────────────────────────

export interface LedgerFilters {
  month?: string
  eventId?: string
  departmentId?: string
  budgetItemId?: string
  query?: string
  stage?: string
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** 달은 `YYYY-MM`이다. 안 넘기면 거르지 않는다. */
function readMonth(asked: string | undefined): string | null {
  const wanted = (asked ?? '').trim()
  if (wanted === '') return null
  if (!MONTH.test(wanted)) throw new Blocked('달은 YYYY-MM 꼴이어야 합니다')
  return wanted
}

/** 결제 단계는 둘뿐이다. **없이 오면 전부다** — 계약이 그렇게 적었다. */
function readStage(asked: string | undefined): Stage | null {
  const wanted = (asked ?? '').trim()
  if (wanted === '') return null
  if (wanted === 'spent' || wanted === 'planned') return wanted
  throw new Blocked('명세에 없는 결제 단계입니다')
}

function blank(asked: string | undefined): string | null {
  const wanted = (asked ?? '').trim()
  return wanted === '' ? null : wanted
}

interface Narrowed {
  month: string | null
  stage: Stage | null
  lines: Line[]
}

async function narrowed(db: Db, orgId: string, asked: LedgerFilters): Promise<Narrowed> {
  const month = readMonth(asked.month)
  const stage = readStage(asked.stage)
  const eventId = blank(asked.eventId)
  const departmentId = blank(asked.departmentId)
  const budgetItemId = blank(asked.budgetItemId)
  const query = blank(asked.query)?.toLowerCase() ?? null

  const all = await lines(db, orgId)
  return {
    month,
    stage,
    lines: all.filter(
      (line) =>
        (month === null || line.month === month) &&
        (stage === null || line.stage === stage) &&
        (eventId === null || line.eventId === eventId) &&
        (departmentId === null || line.departmentId === departmentId) &&
        (budgetItemId === null || line.budgetItemIds.includes(budgetItemId)) &&
        // 내역으로도 행사로도 찾는다 — 칸의 이름이 '내역·행사 검색'이다.
        (query === null ||
          line.title.toLowerCase().includes(query) ||
          line.context.toLowerCase().includes(query)),
    ),
  }
}

// ── 그리는 꼴 ────────────────────────────────────────────────────────────

export interface LedgerRow {
  id: string
  date: string
  title: string
  context: string
  department: string
  budgetItem: string
  amountNote: string
  proof: string
  proofTone: string
}

function drawn(line: Line): LedgerRow {
  return {
    id: line.id,
    // 쓴 날이 없으면 그 자리를 비운 채로 온다 — 예정에는 쓴 날이 없다.
    date: line.when === null ? BLANK : shortDay(line.when),
    title: line.title,
    context: line.context,
    department: line.department,
    budgetItem: line.budgetItem,
    amountNote: won(line.amount),
    proof: line.proof.label,
    proofTone: line.proof.tone,
  }
}

/** 장부의 한 쪽(`finance.ledger`). 잘려서 온다 — 몇 건 중 몇 건인지는 범위 줄이 말한다. */
export async function ledger(db: Db, orgId: string, asked: LedgerFilters): Promise<LedgerRow[]> {
  const { lines: found } = await narrowed(db, orgId, asked)
  return found.slice(0, PER_VIEW).map(drawn)
}

/** `2026-07` → `2026년 7월`. 달 고르기의 글과 범위 줄이 같은 말을 쓴다. */
function monthLabelOf(month: string): string {
  const [year, mm] = month.split('-')
  return `${year}년 ${Number(mm)}월`
}

export interface LedgerScope {
  rangeNote: string
  handlingNote: string
}

/**
 * 지금 보고 있는 장부가 무엇의 몇 줄인지(`finance.ledgerScope`).
 *
 * **역할 이름이 여기 들어간다.** 권한 행렬에서 만든 글이라(`whoCanNote`) 행렬을 고치면
 * 명세가 아니라 이 값이 바뀐다 — `event.endPermission`과 같은 자리다.
 */
export async function ledgerScope(db: Db, orgId: string, asked: LedgerFilters): Promise<LedgerScope> {
  const { month, stage, lines: found } = await narrowed(db, orgId, asked)
  const total = found.length
  const parts = [
    month === null ? '전체 기간' : monthLabelOf(month),
    stage === null ? null : STAGE_NOTE[stage],
    total > PER_VIEW ? `총 ${total}건 중 최근 ${PER_VIEW}건 표시` : `총 ${total}건`,
  ]
  return {
    rangeNote: parts.filter((part): part is string => part !== null).join(' · '),
    handlingNote: `${whoCanNote('finance.manage', '증빙 처리와 정산 완료')} 각 행사 재정의 ‘증빙 필요’ 단계(결제·증빙 정리)에서 진행합니다.`,
  }
}

export interface LedgerSummary {
  termTotal: string
  monthLabel: string
  monthTotal: string
  proofDone: string
  proofMissing: string
}

/**
 * 사용 내역 머리의 값 넷(`finance.ledgerSummary`).
 *
 * **고르지 않았으면 이번 달이다.** 명세에 '이번 달'을 말할 어휘가 없어 화면이 넘길 값이
 * 없다 — 그 판단을 서버가 오늘로 한다. **달의 이름도 서버가 준다** — 다른 해의 달이면 해를
 * 함께 말한다. 첫 칸('이번 학기 총 지출')은 결제 전부의 합이다 — 겉면의 '실제 지출'과
 * 같은 수이고, `budgetAvailable`처럼 회계 기간으로 자르지 않는다(같은 셈).
 */
export async function ledgerSummary(
  db: Db,
  orgId: string,
  askedMonth: string | undefined,
  now: Date,
): Promise<LedgerSummary> {
  const today = moment(now).slice(0, 7)
  const month = readMonth(askedMonth) ?? today
  const spent = (await lines(db, orgId)).filter((line) => line.stage === 'spent')
  const inMonth = spent.filter((line) => line.month === month)
  const done = inMonth.filter((line) => line.proof.label === PROOF.done.label).length
  const missing = inMonth.filter((line) => line.proof.label === PROOF.missing.label).length
  const [year, mm] = month.split('-')
  return {
    termTotal: won(spent.reduce((sum, line) => sum + line.amount, 0)),
    monthLabel: `${year === today.slice(0, 4) ? '' : `${year}년 `}${Number(mm)}월 지출`,
    monthTotal: won(inMonth.reduce((sum, line) => sum + line.amount, 0)),
    proofDone: `${inMonth.length}건 중 ${done}건`,
    proofMissing: `${missing}건`,
  }
}

// ── 전체 재정의 겉면이 얹는 둘 ──────────────────────────────────────────

export interface RecentExpense {
  id: string
  date: string
  title: string
  context: string
  amountNote: string
  proof: string
  proofTone: string
}

/** 최근 지출(`finance.recentExpenses`). **같은 장부다** — 결제 줄을 최근 순으로 몇 줄만 얹는다. */
export async function recentExpenses(db: Db, orgId: string): Promise<RecentExpense[]> {
  const spent = (await lines(db, orgId)).filter((line) => line.stage === 'spent')
  return spent.slice(0, RECENT).map((line) => {
    const { department: _department, budgetItem: _budgetItem, ...row } = drawn(line)
    return row
  })
}

export interface ProofSummary {
  completed: string
  supplement: string
  unregistered: string
  totalNote: string
}

/**
 * 증빙이 어디까지 됐는지(`finance.proofSummary`). **결제마다 하나의 갈래에 든다** —
 * 갈래 셋은 그림이 고정으로 그렸고(증빙 완료·보완 필요·미등록) 장부의 말로는 완료·확인 중·
 * 누락이다(사람이 같은 절차라고 정했다). 전체 지출 건수는 결제의 수다.
 */
export async function proofSummary(db: Db, orgId: string): Promise<ProofSummary> {
  const spent = (await lines(db, orgId)).filter((line) => line.stage === 'spent')
  const count = (key: ProofKey) => spent.filter((line) => line.proof.label === PROOF[key].label).length
  return {
    completed: `${count('done')}건`,
    supplement: `${count('checking')}건`,
    unregistered: `${count('missing')}건`,
    totalNote: `${spent.length}건`,
  }
}

// ── 고르는 목록 셋 ───────────────────────────────────────────────────────

export interface Option {
  value: string
  label: string
  description?: string
}

/**
 * 사용 내역을 볼 달(`finance.ledgerMonths`). **결제가 있는 달**이 최근 순으로 온다 —
 * 조직이 언제부터 있었는지는 표에 달을 세울 사실이 아니라 결제가 찍힌 날이 말한다.
 */
export async function ledgerMonthOptions(db: Db, orgId: string): Promise<Option[]> {
  const months = distinct((await lines(db, orgId)).map((line) => line.month)).sort((a, b) => b.localeCompare(a))
  return months.map((month) => ({ value: month, label: monthLabelOf(month) }))
}

/**
 * 장부를 행사로 거르는 선택지(`finance.ledgerEvents`). **거르지 않는다** — 끝난 행사의
 * 지출도 장부에 있으므로 학생회의 행사 전부가 온다(`event.linkable`과 같은 자리).
 */
export async function ledgerEventOptions(db: Db, orgId: string): Promise<Option[]> {
  const rows = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(eq(events.orgId, orgId))
    .orderBy(asc(events.startAt), asc(events.title), asc(events.id))
  return rows.map((row) => ({ value: row.id, label: row.title }))
}

/**
 * 학생회 전체의 예산 항목(`finance.orgBudgetItems`). 상시와 행사별이 편성한 차례로 온다.
 * 행사별 항목은 어느 행사의 것인지가 곁에 붙는다 — 같은 이름('홍보비')이 상시에도 있다.
 */
export async function orgBudgetItemOptions(db: Db, orgId: string): Promise<Option[]> {
  const rows = await db
    .select({ id: budgetItems.id, name: budgetItems.name, eventName: events.title })
    .from(budgetItems)
    .leftJoin(events, and(eq(budgetItems.eventId, events.id), eq(events.orgId, orgId)))
    .where(eq(budgetItems.orgId, orgId))
    .orderBy(asc(budgetItems.sortOrder), asc(budgetItems.id))
  return rows.map((row) => ({
    value: row.id,
    label: row.name,
    ...(row.eventName === null ? {} : { description: row.eventName }),
  }))
}
