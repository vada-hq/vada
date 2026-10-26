import type { ReactNode } from 'react'
import type { CouncilView } from '@vada/contracts'
import { PurchasePage } from '@/finance/PurchasePage'
import { useHere } from '@/lib/app-location'

// 격리 시험의 c1도 허용하는 최소 라우터. 제품 코드는 Workspace가 UUID 계약으로 가른다.
export function PurchaseRoute({
  view,
  onForbidden,
  children,
}: {
  view: CouncilView
  onForbidden: () => void
  children: ReactNode
}) {
  const here = useHere()
  if (here.path === `/finance/${view.council.id}/requests/new`)
    return <PurchasePage view={view} onForbidden={onForbidden} />
  const prefix = `/purchases/${view.council.id}/`
  if (here.path.startsWith(prefix))
    return (
      <PurchasePage
        view={view}
        requestId={here.path.slice(prefix.length)}
        onForbidden={onForbidden}
      />
    )
  return children
}
