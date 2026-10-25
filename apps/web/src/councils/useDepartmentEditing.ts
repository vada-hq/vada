import { useEffect, useRef, useState } from 'react'
import { departmentNameProblem } from './council-draft'
import type { CouncilDraftState } from './useCouncilDraft'

// 조직도의 카드 하나. 재정 부서는 'finance', 나머지는 부서 줄의 key다.
export type DepartmentRow = number | 'finance'
export type FocusTarget = DepartmentRow | 'add'

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

// 저장하지 못한 카드(빈 이름·같은 이름). 저장하거나 취소할 때까지 이름의 문제를 칸 아래에 보인다.
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

// 지금 고치는 카드와 카드마다 고치기 전 이름.
// 칸을 떠날 때(blur)는 앞 렌더의 값을 보므로, 지금 고치는 카드를 바로 읽을 수 있게 ref에도 둔다.
// 고치기 전 이름은 저장하거나 취소할 때까지 남긴다. 문제로 열린 칸끼리 옮겨 다녀도 Esc가 처음 이름으로 되돌린다.
function useEditingRow() {
  const [editing, setEditingState] = useState<DepartmentRow | null>(null)
  const editingRef = useRef<DepartmentRow | null>(null)
  const originals = useRef(new Map<DepartmentRow, string>())
  const setEditing = (next: DepartmentRow | null) => {
    editingRef.current = next
    setEditingState(next)
  }
  // fresh는 닫힌 카드를 새로 여는 때다. 그때만 고치기 전 이름을 지금 이름으로 새로 둔다.
  const open = (row: DepartmentRow, original: string, fresh: boolean) => {
    if (fresh || !originals.current.has(row)) originals.current.set(row, original)
    setEditing(row)
  }
  // 저장, 취소, 빼기. 고치기 전 이름을 돌려준다.
  const close = (row: DepartmentRow) => {
    const original = originals.current.get(row)
    originals.current.delete(row)
    if (editingRef.current === row) setEditing(null)
    return original
  }
  // 지금 고치는 카드. 누를 때(이벤트) 읽는다.
  const current = () => editingRef.current
  return { editing, current, open, close }
}

type Finishing = Pick<ReturnType<typeof useEditingRow>, 'current' | 'close'> &
  Pick<ReturnType<typeof rowAccess>, 'nameOf' | 'rename'> & {
    problemOf: (row: DepartmentRow) => string | undefined
    mark: (row: DepartmentRow, value: boolean) => void
    remove: (row: number) => void
    focusOn: (target: FocusTarget) => void
  }

// 칸 닫기: 저장(commit)과 취소(cancel).
function finishing({
  current,
  close,
  nameOf,
  rename,
  problemOf,
  mark,
  remove,
  focusOn,
}: Finishing) {
  return {
    // refocus는 Enter로 저장했을 때다. 칸이 닫히면 그 카드의 ⋯ 버튼으로 초점을 돌린다.
    // 저장하면 확인 대상에서 뺀다. 그러지 않으면 다른 카드의 이름 때문에 손대지 않은 이 카드가 다시 열린다.
    commit: (row: DepartmentRow, refocus: boolean) => {
      if (current() !== row) return
      const failed = problemOf(row) !== undefined
      mark(row, failed)
      if (failed) return
      close(row)
      if (refocus) focusOn(row)
    },
    // 새로 더한 빈 카드는 Esc로 더하기를 거둔다.
    cancel: (row: DepartmentRow) => {
      if (current() !== row) return
      const original = close(row) ?? nameOf(row)
      mark(row, false)
      if (row !== 'finance' && original.trim() === '') {
        remove(row)
        focusOn('add')
        return
      }
      rename(row, original)
      focusOn(row)
    },
  }
}

// 조직도 카드의 이름 바꾸기(제자리 편집), 빼기, 더하기와 그 뒤의 초점.
// 한 번에 한 카드만 고친다. 고치는 칸에 문제가 있으면 다른 카드를 열지 않고 그 칸으로 돌아간다.
// 이름은 치는 대로 값에 들어가고, Esc는 고치기 전 이름으로 되돌린다.
// 저장(Enter, 칸을 떠남)할 때 빈 이름·같은 이름이면 칸을 닫지 않고 그 아래에 알린다(Atlassian inline edit).
// focusOn은 조직도(useRowFocus)가 준다. 그린 뒤 그 카드로 초점을 옮긴다.
export function useDepartmentEditing(state: Draft, focusOn: (target: FocusTarget) => void) {
  const { checked, mark } = useCheckedRows()
  const { indexOf, nameOf, rename } = rowAccess(state)
  const { editing, current, open, close } = useEditingRow()
  const problemOf = (row: DepartmentRow) => departmentNameProblem(state.draft, indexOf(row))
  // 고치는 칸에 문제가 있으면 그 칸으로 초점을 돌리고 true.
  function heldByProblem() {
    const open = current()
    if (open === null || !problemOf(open)) return false
    focusOn(open)
    return true
  }
  function remove(row: number) {
    focusOn(rowAfterRemove(state.draft.departments, row))
    close(row)
    mark(row, false)
    state.removeDepartment(row)
  }
  function start(row: DepartmentRow, original = nameOf(row)) {
    if (current() !== row && heldByProblem()) return
    open(row, original, true)
    focusOn(row)
  }
  const finish = finishing({ current, close, nameOf, rename, problemOf, mark, remove, focusOn })
  return {
    ...finish,
    editingRow: editing,
    shownProblemOf: (row: DepartmentRow) => (checked.has(row) ? problemOf(row) : undefined),
    rename,
    remove,
    start: (row: DepartmentRow) => start(row),
    // 문제 때문에 열려 있던 칸(보낼 때 확인, 저장 실패)에 들어오면 그 카드를 고치는 중으로 본다.
    // 그러지 않으면 고치다 문제가 풀리는 순간 칸이 닫히고, Enter·Esc가 듣지 않는다.
    enter: (row: DepartmentRow) => {
      if (current() !== row) open(row, nameOf(row), false)
    },
    addNamed: (name: string) => focusOn(state.addDepartment(name)),
    addBlank: () => {
      if (heldByProblem()) return
      start(state.addDepartment(), '')
    },
  }
}
export type DepartmentEditing = ReturnType<typeof useDepartmentEditing>
