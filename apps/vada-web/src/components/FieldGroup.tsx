import { useId } from 'react'
import type { ReactNode } from 'react'

interface FieldGroupProps {
  /** design 대조가 이 묶음을 찾아가는 끈(spec/screens.ts의 nodeIdOf). */
  nodeId?: string
  title: string
  description?: string | null
  // 묶음의 시각은 화면마다 다르다(element-types.md: design의 사실을 따르고
  // 스키마에 넣지 않는다). ORG-01 14:179는 채움 #F9FAFB, INV-01 14:35는
  // 테두리 #E5E7EB다 — 상자 형태만 화면이 고르고 나머지는 공통이다.
  variant?: 'filled' | 'outlined'
  children: ReactNode
}

// group 요소. 상자: radius 5.25→6(rounded-md), padding 14→16(p-4),
// gap 10.5→12(gap-3).
// 제목 10.5→12(text-xs). 굵기·색도 화면마다 다르다: ORG-01 14:182는 500/
// #4A5565(gray-600), INV-01 14:38은 600/#364153(gray-700).
// 설명 11→text-xs regular gray-400(interpretation 사례표의 스냅).
const BOX_CLASS = {
  filled: 'bg-gray-50',
  outlined: 'border border-gray-200',
}
const TITLE_CLASS = {
  filled: 'font-medium text-gray-600',
  outlined: 'font-semibold text-gray-700',
}

export function FieldGroup({
  nodeId,
  title,
  description,
  variant = 'filled',
  children,
}: FieldGroupProps) {
  // 묶음 제목을 접근성 이름으로 연결해야 보조기술이 이 영역을 하나로 인식한다.
  const titleId = useId()

  return (
    <section
      data-node-id={nodeId}
      aria-labelledby={titleId}
      className={`flex flex-col gap-3 rounded-md p-4 ${BOX_CLASS[variant]}`}
    >
      <div className="flex flex-col">
        <h2 id={titleId} className={`text-xs ${TITLE_CLASS[variant]}`}>
          {title}
        </h2>
        {description && <p className="pt-0.5 text-xs text-gray-400">{description}</p>}
      </div>
      {children}
    </section>
  )
}
