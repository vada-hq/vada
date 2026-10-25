// 넓은 화면의 조직도 한 줄에 놓는 카드 수. 짝수라야 회장단에서 내려오는 가운데 세로선이 카드 사이 틈으로 지나
// 줄을 바꿔도 다음 줄의 가로선까지 이어진다. 넷이면 기본 목록(재정·기획·홍보·부서 추가)이 와이어프레임처럼 한 줄이다.
const CHART_COLUMNS = 4

// 칸 하나의 자리: 몇째 열인지, 그 줄에 칸이 몇인지, 마지막 줄인지.
export type ChartCell = { column: number; rowSize: number; lastRow: boolean }

export function chartCell(index: number, total: number): ChartCell {
  const column = index % CHART_COLUMNS
  const rowStart = index - column
  return {
    column,
    rowSize: Math.min(CHART_COLUMNS, total - rowStart),
    lastRow: rowStart + CHART_COLUMNS >= total,
  }
}

// 줄의 가로선은 칸마다 나눠 그린다. 칸 사이를 grid gap이 아니라 칸 안 여백으로 띄워 칸끼리 맞닿으므로 선이 이어진다.
// 줄의 첫 칸은 가운데에서 시작하고, 마지막 칸은 가운데에서 끝나되 가운데 세로선(전체의 1/2)까지는 닿는다:
// 첫 열에서 끝나면 옆 칸 끝(-right-full)까지, 둘째 열에서 끝나면 칸 끝(right-0)까지.
const LAST_CELL_END = ['-right-full', 'right-0', 'right-1/2', 'right-1/2']
export function busClass({ column, rowSize }: ChartCell) {
  const start = column === 0 ? 'left-1/2' : 'left-0'
  const end = column < rowSize - 1 ? 'right-0' : (LAST_CELL_END[column] ?? 'right-1/2')
  return `${start} ${end}`
}

// 마지막 줄이 아니면 둘째 열 칸의 오른쪽 끝(전체의 1/2)으로 가운데 세로선이 다음 줄까지 내려간다.
export const carriesTrunk = ({ column, lastRow }: ChartCell) => !lastRow && column === 1
