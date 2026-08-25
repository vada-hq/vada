import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'

interface BreadcrumbsProps {
  items: string[]
}

// 상세 화면이 어디에 속하는지 보여주는 현재 위치 경로. 이동 동작은 명세되지 않아 표시만 한다.
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="현재 위치" className="flex flex-wrap items-center gap-1 pb-1 text-xs">
      {items.map((item, index) => (
        <Fragment key={`${index}-${item}`}>
          <span className={index === items.length - 1 ? 'text-gray-600' : 'text-gray-400'}>
            {item}
          </span>
          {index < items.length - 1 ? (
            <ChevronRight aria-hidden="true" className="size-3 text-gray-400" />
          ) : null}
        </Fragment>
      ))}
    </nav>
  )
}
