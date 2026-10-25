import { useEffect, useRef, useState } from 'react'
import { departmentNameProblem } from './council-draft'
import type { CouncilDraftState } from './useCouncilDraft'

// 조직도의 카드 하나. 재정 부서는 'finance', 나머지는 부서 줄의 key다.
export type DepartmentRow = number | 'finance'
export type FocusTarget = DepartmentRow | 'add'
type Editing = { row: DepartmentRow; original: string }

type Draft = Pick<
  CouncilDraftState,
  'draft' | 'set' | 'renameDepartment' | 'removeDepartment' | 'addDepartment'
>

// 카드를 빼면 그 자리에 온 카드, 마지막이었으면 앞 카드, 없으면 재정 부서 카드의 ⋯ 버튼으로 초점을 옮긴다.
// 누른 메뉴의 버튼이 사라져 초점이 페이지 맨 앞으로 가지 않게 한다.
function rowAfterRemove(rows: { key: number }[], key: number): DepartmentRow {
  const index = rows.findIndex(row => row.key === key)
  return rows[index + 1]?.key ?? rows[index - 1]?.key ?? 'finance'
}

// 카드 하나의 차례(departmentNameProblem의 차례), 이름, 이름 바꾸기.
function rowAccess({ draft, set, renameDepartment }: Draft) {
  return {
    indexOf: (row: DepartmentRow) =>
      row === 'finance' ? 0 : draft.departments.findIndex(item => item.key === row) + 1,
    nameOf: (row: DepartmentRow) =>
      row === 'finance'
        ? draft.financeName
        : (draft.departments.find(item => item.key === row)?.name ?? ''),
    rename: (row: DepartmentRow, name: string) =>
      row === 'finance'
        ? set('financeName')({ target: { value: name } })
        : renameDepartment(row, name),
  }
}

// 그린 뒤 data-row가 맞는 요소(⋯ 버튼, 이름 칸, [부서 추가])로 초점을 옮긴다.
// turn은 같은 카드로 다시 옮길 때도 효과가 돌게 하는 번호다.
export function useRowFocus() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState<{ target: FocusTarget; turn: number } | null>(null)
  useEffect(() => {
    if (!focus) return
    containerRef.current?.querySelector<HTMLElement>(`[data-row="${focus.target}"]`)?.focus()
  }, [focus])
  const focusOn = (target: FocusTarget) =>
    setFocus(current => ({ target, turn: (current?.turn ?? 0) + 1 }))
  return { containerRef, focusOn }
}

// 저장을 한 번 해 본 카드. 그때부터 이름의 문제를 칸 아래에 보인다.
function useCheckedRows() {
  const [checked, setChecked] = useState<ReadonlySet<DepartmentRow>>(new Set())
  const mark = (row: DepartmentRow, value: boolean) =>
    setChecked(current => {
      const next = new Set(current)
      if (value) next.add(row)
      else next.delete(row)
      return next
    })
  return { checked, mark }
}

// 지금 고치는 카드와 고치기 전 이름.
// 칸을 떠날 때(blur)는 앞 렌더의 값을 보므로, 지금 고치는 카드를 바로 읽을 수 있게 ref에도 둔다.
function useEditingRow() {
  const [editing, setEditingState] = useState<Editing | null>(null)
  const editingRef = useRef<Editing | null>(null)
  const setEditing = (next: Editing | null) => {
    editingRef.current = next
    setEditingState(next)
  }
  return { editing, editingRef, setEditing }
}

// 조직도 카드의 이름 바꾸기(제자리 편집), 빼기, 더하기와 그 뒤의 초점.
// 한 번에 한 카드만 고친다. 이름은 치는 대로 값에 들어가고, Esc는 고치기 전 이름으로 되돌린다.
// 저장(Enter, 칸을 떠남)할 때 빈 이름·같은 이름이면 칸을 닫지 않고 그 아래에 알린다(Atlassian inline edit).
// focusOn은 조직도(useRowFocus)가 준다. 그린 뒤 그 카드로 초점을 옮긴다.
export function useDepartmentEditing(state: Draft, focusOn: (target: FocusTarget) => void) {
  const { checked, mark } = useCheckedRows()
  const { indexOf, nameOf, rename } = rowAccess(state)
  const { editing, editingRef, setEditing } = useEditingRow()
  const problemOf = (row: DepartmentRow) => departmentNameProblem(state.draft, indexOf(row))
  function remove(row: number) {
    focusOn(rowAfterRemove(state.draft.departments, row))
    if (editingRef.current?.row === row) setEditing(null)
    mark(row, false)
    state.removeDepartment(row)
  }
  function start(row: DepartmentRow, original = nameOf(row)) {
    setEditing({ row, original })
    focusOn(row)
  }
  // refocus는 Enter로 저장했을 때다. 칸이 닫히면 그 카드의 ⋯ 버튼으로 초점을 돌린다.
  function commit(row: DepartmentRow, refocus: boolean) {
    if (editingRef.current?.row !== row) return
    mark(row, true)
    if (problemOf(row)) return
    setEditing(null)
    if (refocus) focusOn(row)
  }
  // 새로 더한 빈 카드는 Esc로 더하기를 거둔다.
  function cancel(row: DepartmentRow) {
    const current = editingRef.current
    if (current?.row !== row) return
    if (row !== 'finance' && current.original.trim() === '') {
      remove(row)
      focusOn('add')
      return
    }
    rename(row, current.original)
    mark(row, false)
    setEditing(null)
    focusOn(row)
  }
  return {
    editingRow: editing?.row ?? null,
    shownProblemOf: (row: DepartmentRow) => (checked.has(row) ? problemOf(row) : undefined),
    rename,
    remove,
    start: (row: DepartmentRow) => start(row),
    // 문제 때문에 열려 있던 칸(보낼 때 확인, 저장 실패)에 들어오면 그 카드를 고치는 중으로 본다.
    // 그러지 않으면 고치다 문제가 풀리는 순간 칸이 닫히고, Enter·Esc가 듣지 않는다.
    enter(row: DepartmentRow) {
      if (editingRef.current?.row !== row) setEditing({ row, original: nameOf(row) })
    },
    commit,
    cancel,
    addNamed: (name: string) => focusOn(state.addDepartment(name)),
    addBlank: () => start(state.addDepartment(), ''),
  }
}
export type DepartmentEditing = ReturnType<typeof useDepartmentEditing>
