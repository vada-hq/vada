import { encode } from 'uqr'

// QR 칸(true = 검정). 오류 정정 M, 여백 2칸이다. 휴대폰 화면을 찍을 때 반사·기울기를 견디는 보통 수준이다.
export const qrMatrix = (text: string): boolean[][] => encode(text, { ecc: 'M', border: 2 }).data

// 검은 칸을 SVG path 하나로 줄인다(칸마다 요소를 두면 큰 QR이 느리다). 한 줄에서 이어진 검은 칸은 가로로 긴 네모 하나다.
export function qrPath(matrix: boolean[][]): string {
  const runs: string[] = []
  matrix.forEach((row, y) => {
    let start = -1
    // 줄 끝에 흰 칸 하나를 더 보아 마지막 검은 줄도 닫는다.
    for (const [x, dark] of [...row, false].entries()) {
      if (dark && start < 0) start = x
      if (!dark && start >= 0) {
        runs.push(`M${start} ${y}h${x - start}v1h-${x - start}z`)
        start = -1
      }
    }
  })
  return runs.join('')
}
