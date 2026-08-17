import { useId } from 'react'
import type { ReactNode } from 'react'

interface FieldGroupProps {
  title: string
  description?: string | null
  children: ReactNode
}

// group 요소. 묶음 상자 14:179: bg gray-50, radius 5.25→6(rounded-md),
// padding 14→16(p-4), gap 10.5→12(gap-3).
// 제목 14:182: 10.5→12(text-xs) medium gray-600.
// 설명 14:184: 11→text-xs regular gray-400(interpretation 사례표의 스냅).
export function FieldGroup({ title, description, children }: FieldGroupProps) {
  // 묶음 제목을 접근성 이름으로 연결해야 보조기술이 이 영역을 하나로 인식한다.
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 rounded-md bg-gray-50 p-4">
      <div className="flex flex-col">
        <h2 id={titleId} className="text-xs font-medium text-gray-600">
          {title}
        </h2>
        {description && <p className="pt-0.5 text-xs text-gray-400">{description}</p>}
      </div>
      {children}
    </section>
  )
}
