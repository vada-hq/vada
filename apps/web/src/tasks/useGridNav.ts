import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { moveCell, settleCell, type GridKey, type GridPos } from './grid-nav'

const NAV_KEYS = new Set<string>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'])

function cellAt(grid: HTMLElement | null, pos: GridPos | null) {
  if (!grid || !pos) return null
  const cells = grid.querySelectorAll<HTMLElement>('[role="gridcell"]')
  return (
    [...cells].find(cell => cell.dataset.row === pos.id && cell.dataset.col === String(pos.col)) ??
    null
  )
}

const samePos = (a: GridPos | null, b: GridPos | null) => a?.id === b?.id && a?.col === b?.col

function refocus(grid: HTMLElement | null, pos: GridPos | null) {
  if (grid && !grid.contains(document.activeElement)) cellAt(grid, pos)?.focus()
}

const cellPos = (cell: HTMLElement): GridPos => ({
  id: cell.dataset.row ?? '',
  col: Number(cell.dataset.col),
})
const cellOf = (target: EventTarget) =>
  target instanceof HTMLElement ? target.closest<HTMLElement>('[role="gridcell"]') : null

// 칸 안의 고르는 칸이나 글 칸으로 들어간다(고치기 시작). 글자로 보이는 글 칸은 시작 단추(data-edit-start)를 누른다.
// 고칠 수 없는 칸에 누를 단추(data-cell-action, 담당자 이름의 1:1)가 있으면 그 단추로 들어가고, 없으면 아무것도 하지 않는다.
function startEdit(cell: HTMLElement) {
  const field = cell.querySelector<HTMLElement>('select, input')
  const start = cell.querySelector<HTMLElement>('[data-edit-start]')
  if (field) field.focus()
  else if (start) start.click()
  else cell.querySelector<HTMLElement>('[data-cell-action] button')?.focus()
}

type Grid = { ids: string[]; cols: number; onOpen: (taskId: string) => void }

// 칸에 초점이 있을 때의 키. 이동하면 새 위치를, 아니면 null이다.
function keyOnCell(event: KeyboardEvent, cell: HTMLElement, grid: Grid): GridPos | null {
  const at = cellPos(cell)
  if (NAV_KEYS.has(event.key)) {
    event.preventDefault()
    return moveCell(grid, at, event.key as GridKey, event.ctrlKey)
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    if (at.col === 0) grid.onOpen(at.id)
    else startEdit(cell)
  }
  return null
}

// F2는 칸과 고치기를 오가고, Escape는 고치기를 그만두고 칸으로 돌아온다. 그 밖의 키는 칸에서만 듣는다.
function handleKey(event: KeyboardEvent, grid: Grid, go: (pos: GridPos) => void) {
  const cell = cellOf(event.target)
  if (!cell) return
  const onCell = event.target === cell
  if (event.key === 'F2' || (event.key === 'Escape' && !onCell)) {
    event.preventDefault()
    return onCell ? startEdit(cell) : cell.focus()
  }
  const next = onCell ? keyOnCell(event, cell, grid) : null
  if (next) go(next)
}

// 표 밖을 누르면 표를 떠난 것이다(blur만으로는 칸이 다시 꽂힌 것과 가를 수 없다).
function useLeaveOnPointer(
  gridRef: RefObject<HTMLTableElement | null>,
  inside: RefObject<boolean>,
) {
  useEffect(() => {
    const leave = (event: PointerEvent) => {
      if (event.target instanceof Node && !gridRef.current?.contains(event.target))
        inside.current = false
    }
    document.addEventListener('pointerdown', leave)
    return () => document.removeEventListener('pointerdown', leave)
  }, [gridRef, inside])
}

// WAI-ARIA grid의 키보드(초점은 칸 하나, 칸 안의 단추·선택칸은 Tab 순서에 없다).
// 다시 읽어 줄이 옮기거나 빠져도 초점은 같은 업무의 같은 칸을 따라가고, 그 칸이 사라지면 다음 줄의 같은 칸으로 간다.
export function useGridNav(
  gridRef: RefObject<HTMLTableElement | null>,
  ids: string[],
  cols: number,
  onOpen: (taskId: string) => void,
) {
  const [stored, setStored] = useState<GridPos | null>(null)
  // 효과가 늦게 돌아도 그사이 초점이 옮긴 칸을 알도록, 칸의 원문은 ref이고 state는 그리기용이다.
  const current = useRef<GridPos | null>(null)
  const put = (pos: GridPos | null) => {
    current.current = pos
    setStored(pos)
  }
  const before = useRef<string[]>(ids)
  const inside = useRef(false)
  const key = ids.join('\n')

  useEffect(() => {
    const now = key === '' ? [] : key.split('\n')
    const next = settleCell(current.current, before.current, now)
    before.current = now
    if (!samePos(next, current.current)) {
      current.current = next
      setStored(next)
    }
    // 줄이 옮겨 그 칸의 DOM이 바뀌면 초점을 잃으므로, 표에 있던 초점이면 같은 칸에 돌려 놓는다.
    if (inside.current) refocus(gridRef.current, next)
  }, [key, stored, gridRef])

  const go = (pos: GridPos) => {
    put(pos)
    cellAt(gridRef.current, pos)?.focus()
  }
  const onFocus = (event: FocusEvent) => {
    inside.current = true
    const cell = cellOf(event.target)
    if (cell) put(cellPos(cell))
  }
  const onBlur = (event: FocusEvent) => {
    // 가는 곳이 표 밖이면 떠난 것이다. 가는 곳이 없는 blur는 줄이 옮겨 칸이 다시 꽂힌 것일 수 있어 떠난 것으로 보지 않고,
    // 표 밖을 누르는 것은 아래 pointerdown이 본다.
    const next = event.relatedTarget
    if (next instanceof Node && !gridRef.current?.contains(next)) inside.current = false
  }
  useLeaveOnPointer(gridRef, inside)
  // 아직 고른 칸이 없으면 첫 줄 첫 칸이 Tab의 자리다.
  const at = stored ?? (ids[0] === undefined ? null : { id: ids[0], col: 0 })
  return {
    onKeyDown: (event: KeyboardEvent) => handleKey(event, { ids, cols, onOpen }, go),
    onFocus,
    onBlur,
    tabIndexOf: (id: string, col: number) => (at?.id === id && at.col === col ? 0 : -1),
  }
}
