import type { C2Props } from '../c2-props'

// e5 자리(② 행사 구역 시안 c2). 이 폴더(e5/) 안만 고친다. 공용 파일(../c2-data.ts, ../c2-props.ts, ../C2Preview.tsx)은 읽기만 한다.
// 기본 내보내기 하나가 컴포넌트 전체다. 바깥 여백·폭은 껍데기가 맞추므로 이 컴포넌트는 폭 전체를 쓴다.
// 측정용 표시: 행사 하나를 감싸는 요소에 data-c2-event={event.id}, 지남·예산 초과 신호에 data-c2-danger(판 문서 c2-board.md).
export default function C2E5(_: C2Props) {
  return (
    <section className="flex h-40 items-center justify-center rounded-lg border border-dashed border-input bg-card text-sm text-fg-muted">
      e5 자리
    </section>
  )
}
