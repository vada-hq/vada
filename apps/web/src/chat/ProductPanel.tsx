import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHideBottomNavigation } from '@/components/BottomNavigationVisibility'
import { openRecord } from '@/lib/go-to'
import { blockingOf } from './useMessageActions'
import { useWindowHistory } from '@/lib/use-window-history'
import type { RoomPage } from './ChatPage'
import { useProductInfo } from './product-info'
import ProductDetails, { withItem } from './ProductDetails'
import type { ProductTarget } from './product-open'
import RequestFlowView from './RequestFlowView'
import { useRequestFlow } from './useRequestFlow'

// 연 순간의 포커스로 닫을 때 돌아간다(상태로 여닫는 창의 관례, components/ui/dialog의 useReturnFocus).
function useReturnFocusOnClose() {
  useEffect(() => {
    const opener = document.activeElement
    return () => {
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected)
        opener.focus()
    }
  }, [])
}

// 상품 정보 패널의 틀(022 정한 것 20, 와이어프레임 P-15): 머리에 '상품 정보'와 [닫기], 아래에 내용.
// 자리와 폭은 1:1 패널과 같다: 1280px 이상은 작업 공간 오른쪽에 붙고, 768~1279px은 오른쪽 위에 겹쳐 뜨며, 휴대폰은 전체 화면이다.
// 1:1 칸과 같은 흰 머리다. 열리면 머리로 포커스를 옮기고, Esc·뒤로 가기로 닫으며, 닫으면 연 링크로 포커스가 돌아간다.
export function ProductPanelFrame({
  focusKey,
  onClose,
  children,
}: {
  // 바뀌면(다른 링크) 머리로 다시 포커스를 옮긴다.
  focusKey: string
  onClose: () => void
  children: ReactNode
}) {
  useHideBottomNavigation()
  const heading = useRef<HTMLHeadingElement>(null)
  // 머리로 옮기기 전에 연 링크를 기억해야 하므로 먼저 부른다(effect는 적은 차례로 돈다).
  useReturnFocusOnClose()
  useEffect(() => heading.current?.focus(), [focusKey])
  useWindowHistory(onClose)
  return (
    <aside
      aria-label="상품 정보"
      className="fixed inset-0 z-40 flex flex-col bg-white md:left-auto md:w-96 md:border-l md:shadow-2xl xl:static xl:z-auto xl:shrink-0 xl:shadow-none"
      onKeyDown={event => {
        // 패널 안에서 연 대화상자(구매 요청)는 포털이라 React 이벤트가 여기까지 오른다. 그 Esc는 그 창만 닫는다.
        const inside = event.currentTarget.contains(event.target as Node)
        if (event.key === 'Escape' && inside && !event.defaultPrevented) onClose()
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b py-2 pr-2 pl-4">
        <h2
          ref={heading}
          tabIndex={-1}
          className="min-w-0 text-base font-semibold text-fg outline-none"
        >
          상품 정보
        </h2>
        <Button
          variant="ghost"
          size="icon"
          touch
          className="ml-auto"
          aria-label="닫기"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">{children}</div>
    </aside>
  )
}

// 이 상품과 고른 판매 단위로 구매 요청을 시작한다. 기존 메시지 근거 연결을 그대로 쓴다.
function RequestButton({
  target,
  flow,
  councilId,
}: {
  councilId: string
  target: ProductTarget
  flow: ReturnType<typeof useRequestFlow>
}) {
  // 여기서 막 낸 요청은 아래 안내의 [재정에서 보기]가 연다(같은 버튼을 두 번 두지 않는다).
  if (flow.madeId) return null
  const made = blockingOf(target.message, 'purchase_request')
  if (made)
    return (
      <Button touch onClick={() => openRecord('purchases', councilId, made.id)}>
        구매 요청 보기
      </Button>
    )
  return (
    <Button touch onClick={() => flow.start(target.message)}>
      구매 요청 만들기
    </Button>
  )
}

type Props = { page: RoomPage; target: ProductTarget }

// 링크 하나의 내용. 상품을 읽고, 권한이 있으면 그 메시지로 구매 요청을 낸다. 상품을 불러왔을 때만 요청 버튼이 있다.
function ProductContent({ page, target }: Props) {
  const state = useProductInfo(page.councilId, target.url)
  const flow = useRequestFlow()
  const { view } = page
  const canRequest = view.permissions.includes('purchase.request')
  // 판매 단위가 여럿이면 패널에서 고른 단위로 구매 요청을 채운다. 고르기 전에는 링크가 가리킨 단위다.
  const [itemId, setItemId] = useState<string>()
  const product = state.kind === 'ready' ? withItem(state.product, itemId) : null
  return (
    <>
      <ProductDetails
        state={state}
        url={target.url}
        itemId={itemId}
        onItemChange={setItemId}
        request={
          canRequest && <RequestButton councilId={page.councilId} target={target} flow={flow} />
        }
      />
      <RequestFlowView
        councilId={page.councilId}
        meId={view.me.memberId}
        team={page.team.data}
        canRequest={canRequest}
        canAssign={view.permissions.includes('finance.manage')}
        flow={flow}
        eventId={target.eventId}
        picked={product ? { link: target.url, product, itemId: product.selectedItemId } : undefined}
        onOpenRequest={page.onOpenRequest}
        onForbidden={page.onForbidden}
      />
    </>
  )
}

// 쿠팡 상품 링크로 연 상품 정보 패널. 다른 링크를 누르면 틀은 그대로 두고 내용만 그 링크로 새로 연다.
export default function ProductPanel({ onClose, ...props }: Props & { onClose: () => void }) {
  const key = `${props.target.message.id} ${props.target.url}`
  return (
    <ProductPanelFrame focusKey={key} onClose={onClose}>
      <ProductContent key={key} {...props} />
    </ProductPanelFrame>
  )
}
