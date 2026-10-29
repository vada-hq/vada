import type { BuilderProps } from '../builder-props'

// v3 자리(양식 만들기 화면 시안). 이 폴더(v3/) 안만 고친다. 공용 파일(../builder-data.ts, ../builder-forms.ts,
// ../builder-props.ts, ../apply-preview.tsx, ../BuilderPreview.tsx, ../builder-main.tsx)은 읽기만 한다.
// 기본 내보내기 하나가 세 화면(props.screen: card·editor·empty)을 모두 그린다. 행사 화면 탭 안 내용 영역만 그린다(셸은 껍데기).
// 판 문서: notes/integration/events/form-builder-board.md
export default function BuilderV3({ screen, data }: BuilderProps) {
  return (
    <section className="flex h-40 items-center justify-center rounded-lg border border-dashed border-default bg-surface-subtle text-sm text-fg-muted">
      v3 자리 · {screen} · {data.name}
    </section>
  )
}
