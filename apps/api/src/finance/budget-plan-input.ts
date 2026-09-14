import { Blocked } from '../errors.ts'
import { readWord } from '../input.ts'
import { won } from './labels.ts'

type Row = Record<string, unknown>

const ROW_SEPARATOR = '\n'
const DAY = /^\d{4}-\d{2}-\d{2}$/

export interface BudgetSourceInput {
  id: string | null
  name: string
  amount: number
}

export interface BudgetItemInput {
  id: string | null
  eventId: string | null
  name: string
  amount: number
  departmentId: string | null
}

export interface BudgetPlanInput {
  startsOn: string
  endsOn: string
  sources: BudgetSourceInput[]
  items: BudgetItemInput[]
  eventItems: BudgetItemInput[]
}

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

function requiredWord(row: Row, key: string, label: string): string {
  const word = readWord(row, key, label)
  if (word === null) throw new Blocked(`${label} 칸이 비어 있습니다`)
  return word
}

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

function readDay(draft: Row, key: string, label: string): string {
  const word = requiredWord(draft, key, label)
  const real = new Date(`${word}T00:00:00Z`)
  if (!DAY.test(word) || Number.isNaN(real.getTime()) || real.toISOString().slice(0, 10) !== word) {
    throw new Blocked(`${label} 칸은 YYYY-MM-DD 꼴의 날짜여야 합니다`)
  }
  return word
}

function noDuplicateIds(rows: Array<{ id: string | null }>, label: string): void {
  const seen = new Set<string>()
  for (const row of rows) {
    if (row.id === null) continue
    if (seen.has(row.id)) throw new Blocked(`${label}에 같은 줄이 두 번 왔습니다`)
    seen.add(row.id)
  }
}

export function parseBudgetPlanInput(body: unknown): BudgetPlanInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new Blocked('예산 편성 한 벌의 모양이 아닙니다')
  }
  const draft = body as Row
  const startsOn = readDay(draft, 'periodStart', '시작일')
  const endsOn = readDay(draft, 'periodEnd', '끝일')
  if (startsOn > endsOn) throw new Blocked('시작일이 끝일보다 늦습니다')

  const sources: BudgetSourceInput[] = rowsOf(draft, 'sources', '수입원').map((row) => ({
    id: readWord(row, 'id', '수입원 줄'),
    name: requiredWord(row, 'sourceName', '수입원 이름'),
    amount: readAmount(row, 'sourceAmount', '수입원 금액'),
  }))
  const items: BudgetItemInput[] = rowsOf(draft, 'items', '상시 예산 항목').map((row) => ({
    id: readWord(row, 'id', '항목 줄'),
    eventId: null,
    name: requiredWord(row, 'itemName', '항목 이름'),
    amount: readAmount(row, 'itemAmount', '항목 배정액'),
    departmentId: readWord(row, 'itemDepartment', '담당 부서'),
  }))
  const eventItems: BudgetItemInput[] = rowsOf(draft, 'eventItems', '행사별 예산 항목').map(
    (row) => ({
      id: readWord(row, 'id', '행사 항목 줄'),
      eventId: requiredWord(row, 'eventItemEvent', '행사'),
      name: requiredWord(row, 'eventItemName', '행사 항목 이름'),
      amount: readAmount(row, 'eventItemAmount', '행사 항목 배정액'),
      departmentId: readWord(row, 'eventItemDepartment', '행사 항목 담당 부서'),
    }),
  )
  noDuplicateIds(sources, '수입원')
  noDuplicateIds([...items, ...eventItems], '예산 항목')

  const income = sources.reduce((sum, row) => sum + row.amount, 0)
  const allotted = [...items, ...eventItems].reduce((sum, row) => sum + row.amount, 0)
  if (allotted > income) {
    throw new Blocked(`배정 합계 ${won(allotted)}이 수입 합계 ${won(income)}을 넘습니다`)
  }
  return { startsOn, endsOn, sources, items, eventItems }
}
