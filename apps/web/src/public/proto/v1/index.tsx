import type { FormProps } from '../form-props'

// v1 자리(신청자 화면 시안). 이 폴더(v1/) 안만 고친다. 공용 파일(../form-data.ts, ../form-props.ts, ../FormPreview.tsx, ../preview-main.tsx)은 읽기만 한다.
// 기본 내보내기 하나가 세 화면(props.screen: apply·done·closed)을 모두 그린다. 페이지 전체(바탕·여백·폭)를 이 안이 정한다.
// 판 문서: notes/integration/events/form-apply-board.md
export default function FormV1({ screen, data }: FormProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-6">
      <section className="flex h-40 items-center justify-center rounded-lg border border-dashed border-default bg-surface-subtle text-sm text-fg-muted">
        v1 자리 · {screen} · {data.name}
      </section>
    </main>
  )
}
