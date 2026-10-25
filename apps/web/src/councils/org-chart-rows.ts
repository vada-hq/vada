// 넓은 화면의 조직도 한 줄에 놓는 카드 수. 짝수라야 회장단에서 내려오는 가운데 세로선이 카드 사이 틈으로 지나
// 줄을 바꿔도 다음 줄의 가로선까지 이어진다. 넷이면 기본 목록(재정·기획·홍보·부서 추가)이 와이어프레임처럼 한 줄이다.
const CHART_COLUMNS = 4

export function chartRows<T>(items: T[]): T[][] {
  const rows: T[][] = []
  for (let start = 0; start < items.length; start += CHART_COLUMNS)
    rows.push(items.slice(start, start + CHART_COLUMNS))
  return rows
}

// 줄의 가로선은 첫 칸 가운데(1/8)에서 시작해, 마지막 카드 가운데와 가운데 세로선(1/2) 중 오른쪽에서 끝난다.
// 칸 사이를 grid gap이 아니라 칸 안 여백으로 띄워 칸 가운데가 정확히 1/8, 3/8, 5/8, 7/8이다.
const BUS_END = ['right-1/2', 'right-1/2', 'right-3/8', 'right-1/8']
export const busEndClass = (count: number) => BUS_END[count - 1] ?? 'right-1/8'
