import type { Db } from '../db/client.ts'
import { Blocked } from '../errors.ts'
import { whoCanNote } from '../events/ending.ts'
import { shortDay } from '../ops/calendar.ts'
import { BLANK, won } from './labels.ts'
import {
  ledgerLines,
  PER_VIEW,
  STAGE_NOTE,
  type LedgerLine,
  type LedgerStage,
} from './ledger-lines.ts'

export interface LedgerFilters {
  month?: string
  eventId?: string
  departmentId?: string
  budgetItemId?: string
  query?: string
  stage?: string
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

export function readLedgerMonth(asked: string | undefined): string | null {
  const wanted = (asked ?? '').trim()
  if (wanted === '') return null
  if (!MONTH.test(wanted)) throw new Blocked('달은 YYYY-MM 꼴이어야 합니다')
  return wanted
}

function readStage(asked: string | undefined): LedgerStage | null {
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
  stage: LedgerStage | null
  lines: LedgerLine[]
}

async function narrowed(db: Db, orgId: string, asked: LedgerFilters): Promise<Narrowed> {
  const month = readLedgerMonth(asked.month)
  const stage = readStage(asked.stage)
  const eventId = blank(asked.eventId)
  const departmentId = blank(asked.departmentId)
  const budgetItemId = blank(asked.budgetItemId)
  const query = blank(asked.query)?.toLowerCase() ?? null
  const all = await ledgerLines(db, orgId)
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
        (query === null ||
          line.title.toLowerCase().includes(query) ||
          line.context.toLowerCase().includes(query)),
    ),
  }
}

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

export function drawLedgerLine(line: LedgerLine): LedgerRow {
  return {
    id: line.id,
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

export async function ledger(db: Db, orgId: string, asked: LedgerFilters): Promise<LedgerRow[]> {
  const { lines } = await narrowed(db, orgId, asked)
  return lines.slice(0, PER_VIEW).map(drawLedgerLine)
}

export function ledgerMonthLabel(month: string): string {
  const [year, mm] = month.split('-')
  return `${year}년 ${Number(mm)}월`
}

export interface LedgerScope {
  rangeNote: string
  handlingNote: string
}

export async function ledgerScope(db: Db, orgId: string, asked: LedgerFilters): Promise<LedgerScope> {
  const { month, stage, lines } = await narrowed(db, orgId, asked)
  const total = lines.length
  const parts = [
    month === null ? '전체 기간' : ledgerMonthLabel(month),
    stage === null ? null : STAGE_NOTE[stage],
    total > PER_VIEW ? `총 ${total}건 중 최근 ${PER_VIEW}건 표시` : `총 ${total}건`,
  ]
  return {
    rangeNote: parts.filter((part): part is string => part !== null).join(' · '),
    handlingNote: `${whoCanNote('finance.manage', '증빙 처리와 정산 완료')} 각 행사 재정의 ‘증빙 필요’ 단계(결제·증빙 정리)에서 진행합니다.`,
  }
}
