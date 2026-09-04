/**
 * 한 영역이 진짜 서버에서 받는 것들.
 *
 * **읽기와 쓰기를 한 자리에 둔다.** 오랫동안 읽기만 세고 있었고, 그동안 쓰기는
 * 통째로 가짜였다 — '조직 만들기'를 누르면 학생회가 안 생기는데 다음 화면으로
 * 넘어갔다. 두 목록이 멀리 떨어져 있으면 한쪽만 옮기고 잊는다.
 */
export interface Served {
  readonly reads: readonly string[]
  readonly writes: readonly string[]
}
