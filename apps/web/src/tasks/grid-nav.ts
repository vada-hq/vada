// WAI-ARIA grid의 칸 이동. 화면과 상관없이 위치만 셈한다.
export type GridPos = { id: string; col: number }
export type GridKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End'

const clamp = (value: number, last: number) => Math.max(0, Math.min(value, last))

// 가장자리에서는 멈춘다(돌아 나가지 않는다). 묶음 머리 줄은 ids에 없어 건너뛴다.
export function moveCell(
  { ids, cols }: { ids: string[]; cols: number },
  at: GridPos,
  key: GridKey,
  ctrl: boolean,
): GridPos {
  const row = ids.indexOf(at.id)
  const lastRow = ids.length - 1
  const lastCol = cols - 1
  const pick = (r: number, c: number): GridPos => ({
    id: ids[clamp(r, lastRow)] ?? at.id,
    col: clamp(c, lastCol),
  })
  if (key === 'Home') return ctrl ? pick(0, 0) : pick(row, 0)
  if (key === 'End') return ctrl ? pick(lastRow, lastCol) : pick(row, lastCol)
  if (key === 'ArrowUp') return pick(row - 1, at.col)
  if (key === 'ArrowDown') return pick(row + 1, at.col)
  return pick(row, at.col + (key === 'ArrowLeft' ? -1 : 1))
}

// 다시 읽은 뒤의 초점 칸. 업무가 아직 있으면 같은 업무의 같은 칸(묶음을 옮겨도 따라간다),
// 보기에서 빠졌으면 이전 차례에서 그 뒤에 있던 업무의 같은 칸, 뒤가 없으면 마지막 업무다.
export function settleCell(at: GridPos | null, before: string[], now: string[]): GridPos | null {
  const first = now[0]
  if (first === undefined) return null
  if (at === null) return { id: first, col: 0 }
  if (now.includes(at.id)) return at
  const after = before.slice(before.indexOf(at.id) + 1).find(id => now.includes(id))
  return { id: after ?? now[now.length - 1] ?? first, col: at.col }
}
