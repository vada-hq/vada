import { Fragment } from 'react'
import { FigmaAsset } from './FigmaAsset'

interface BreadcrumbsProps {
  nodeId?: string
  screenId: string
  items: string[]
  /**
   * 조각 사이에 오는 화살표의 design 노드. 첫 조각 앞에는 없으므로 조각보다 하나 적다.
   * 어떤 그림이 오는지는 명세가 아니라 design이 갖는다 — 그래서 화면이 지목한다.
   */
  separatorNodeIds: string[]
}

// 상세 화면이 어디에 속하는지 보여주는 현재 위치 경로. 이동 동작은 명세되지 않아 표시만 한다.
export function Breadcrumbs({ nodeId, screenId, items, separatorNodeIds }: BreadcrumbsProps) {
  return (
    <nav
      data-node-id={nodeId}
      aria-label="현재 위치"
      className="flex flex-wrap items-center gap-1 pb-1 text-xs"
    >
      {items.map((item, index) => (
        <Fragment key={`${index}-${item}`}>
          {index === 0 ? null : (
            <FigmaAsset
              screenId={screenId}
              nodeId={separatorNodeIds[index - 1] ?? ''}
              className="size-3"
            />
          )}
          <span className={index === items.length - 1 ? 'text-gray-600' : 'text-gray-400'}>
            {item}
          </span>
        </Fragment>
      ))}
    </nav>
  )
}
