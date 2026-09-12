import { hasFieldValue } from '../../../../../packages/contracts/src/button-execution.mjs'
import type { DataRow } from '../../data-sources/definitions'
import { itemKey, joinRowIds, rowIdsOf } from '../../spec/compute'
import { draftValueOf } from '../../spec/draft-scalar'
import type { ListSpec } from '../../spec/types'
import type { ScopeDraft } from '../../state/scopes'

// 회의 초안의 변환·편집. 입력으로 받은 초안을 바꾸지 않고 다음 초안을 반환한다.
const CHIP_SEPARATOR = ';'
const CHIP_FIELD_SEPARATOR = '|'

interface Chip {
  label: string
  tone: string
}

function encodeChips(value: unknown): string {
  if (!Array.isArray(value)) {
    return ''
  }
  return value
    .map((chip) => {
      const row = chip as DataRow
      return `${String(row.label ?? '')}${CHIP_FIELD_SEPARATOR}${String(row.tone ?? 'gray')}`
    })
    .join(CHIP_SEPARATOR)
}

export function decodeChips(raw: string | null | undefined): Chip[] {
  if (!raw) {
    return []
  }
  return raw.split(CHIP_SEPARATOR).map((part) => {
    const [label, tone] = part.split(CHIP_FIELD_SEPARATOR)
    return { label, tone: tone ?? 'gray' }
  })
}

// 읽어 온 회의를 초안으로 옮긴다(draftFrom).
//
// 되풀이되는 묶음은 줄 이름을 하나씩 붙여 평평하게 담는다(compute.ts의 itemKey).
// 참가자 줄의 딱지만 한 겹 더 깊다 - 값이 글이 아니라 {말, 색 이름}의 목록이라
// 한 줄로 접어 담고 그릴 때 다시 편다.
export function draftFromRow(row: DataRow): ScopeDraft {
  const values: Record<string, string | null> = {}

  for (const [key, value] of Object.entries(row)) {
    if (!Array.isArray(value)) {
      values[key] = draftValueOf(value)
      continue
    }
    const rowIds: string[] = []
    value.forEach((item, index) => {
      const rowId = `r${index}`
      rowIds.push(rowId)
      for (const [field, fieldValue] of Object.entries(item as DataRow)) {
        values[itemKey(key, rowId, field)] = Array.isArray(fieldValue)
          ? encodeChips(fieldValue)
          : draftValueOf(fieldValue)
      }
    })
    values[key] = joinRowIds(rowIds)
  }

  return { values, labels: {} }
}

function nextRowId(rowIds: string[]): string {
  const used = new Set(rowIds)
  for (let index = 0; ; index += 1) {
    const candidate = `r${index}`
    if (!used.has(candidate)) {
      return candidate
    }
  }
}

/** 검색 결과 중 아직 선택하지 않은 첫 참가자를 추가한다. 후보가 없으면 null이다. */
export function addParticipant(
  draft: ScopeDraft,
  listFieldKey: string,
  candidates: readonly DataRow[],
): ScopeDraft | null {
  const rowIds = rowIdsOf(draft, listFieldKey)
  const chosen = candidates.find(
    (candidate) => !rowIds.some(
      (rowId) => (draft.values[itemKey(listFieldKey, rowId, 'memberId')] ?? '') ===
        String(candidate.memberId),
    ),
  )
  if (chosen === undefined) return null
  const rowId = nextRowId(rowIds)
  return {
    values: {
      ...draft.values,
      [itemKey(listFieldKey, rowId, 'memberId')]: String(chosen.memberId),
      [itemKey(listFieldKey, rowId, 'name')]: String(chosen.name),
      [itemKey(listFieldKey, rowId, 'departmentNote')]: String(chosen.departmentNote),
      [itemKey(listFieldKey, rowId, 'chips')]: '',
      [itemKey(listFieldKey, rowId, 'canRemove')]: 'true',
      [listFieldKey]: joinRowIds([...rowIds, rowId]),
    },
    labels: draft.labels,
  }
}

export function removeDraftRow(draft: ScopeDraft, listFieldKey: string, rowId: string): ScopeDraft {
  const values = { ...draft.values }
  for (const key of Object.keys(values)) {
    if (key.startsWith(`${listFieldKey}.${rowId}.`)) delete values[key]
  }
  values[listFieldKey] = joinRowIds(rowIdsOf(draft, listFieldKey).filter((id) => id !== rowId))
  return { values, labels: draft.labels }
}

export function addAgenda(
  draft: ScopeDraft,
  list: Pick<ListSpec, 'fieldKey' | 'itemFields'>,
): ScopeDraft {
  const rowIds = rowIdsOf(draft, list.fieldKey)
  const rowId = nextRowId(rowIds)
  const values = { ...draft.values }
  for (const { spec } of list.itemFields ?? []) {
    if (spec.type === 'input' || spec.type === 'select') {
      values[itemKey(list.fieldKey, rowId, spec.fieldKey)] = spec.initialValue ?? ''
    }
  }
  values[list.fieldKey] = joinRowIds([...rowIds, rowId])
  return { values, labels: draft.labels }
}

/** 되풀이되는 안건의 모든 행을 공통 필수값 판정에 연결한다. */
export function isDraftFieldFilled(
  draft: ScopeDraft,
  candidate: { fieldKey: string; inList: string | null },
): boolean {
  if (candidate.inList === null) return hasFieldValue(draft.values[candidate.fieldKey])
  const listFieldKey = candidate.inList
  return rowIdsOf(draft, listFieldKey).every((rowId) =>
    hasFieldValue(draft.values[itemKey(listFieldKey, rowId, candidate.fieldKey)]),
  )
}
