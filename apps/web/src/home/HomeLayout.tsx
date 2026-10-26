import type { ReactNode } from 'react'

// 홈의 배치 꼴 둘(DEC-95). 본문이 좁으면(1024px 창 아래) 한 단이고, 카드는 기획자 반응형 코드의 차례(이 글 차례)로 쌓인다.
// 같은 줄의 카드는 높이를 맞춘다(와이어프레임 grid 기본값). 폭은 HomeFrame의 @container를 본다.

// 회장단 3열 카드의 머리 바 높이. 1024px 창(본문 약 736px)의 3열에서는 긴 제목('확인이 필요한 운영 상황')이 두 줄이라
// 세 머리를 두 줄 높이로 맞추고, 넓으면(1280px 창) 한 줄이라 풀어 둔다(와이어프레임 머리 바 한 줄, 같은 줄 카드 정렬).
export const COLUMN_HEAD = '@2xl:min-h-16 @4xl:min-h-0'

// 회장단(HOME-01C): 가로 전체 카드 → 3열 → 맨 아래 한 줄.
export function CouncilLayout({
  top,
  columns,
  bottom,
}: {
  top: ReactNode
  columns: [ReactNode, ReactNode, ReactNode]
  bottom?: ReactNode
}) {
  const [first, second, third] = columns
  return (
    <div className="flex flex-col gap-4">
      {top}
      <div className="grid gap-4 @2xl:grid-cols-3">
        {first}
        {second}
        {third}
      </div>
      {bottom}
    </div>
  )
}

// 부서장·부원·재정부(HOME-01D·01M·01F): 2×2 → 그 아래 조건부 줄.
export function GridLayout({
  cards,
  below,
}: {
  // 왼쪽 위, 오른쪽 위, 왼쪽 아래, 오른쪽 아래
  cards: [ReactNode, ReactNode, ReactNode, ReactNode]
  below?: ReactNode
}) {
  const [topLeft, topRight, bottomLeft, bottomRight] = cards
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 @2xl:grid-cols-2">
        {topLeft}
        {topRight}
        {bottomLeft}
        {bottomRight}
      </div>
      {below}
    </div>
  )
}
