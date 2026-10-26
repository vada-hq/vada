import { useCallback, useMemo, type ReactNode } from 'react'
import type { CouncilView } from '@vada/contracts'
import type { Team } from '../team/useTeam'
import type { RoomPage } from './ChatPage'
import DirectPanel from './DirectPanel'
import { DirectOpenContext } from './direct-open'
import { ProductOpenContext, useProductPanel } from './product-open'
import ProductPanel from './ProductPanel'
import { ReplyOpenContext, useReplyPanel, type ReplyTarget } from './reply-open'
import ReplyPanel from './ReplyPanel'
import { useDirectPanel } from './useDirectPanel'
import type { RoomList } from './useRoomList'

type Args = {
  councilId: string
  view: CouncilView | null
  team: Team
  rooms: RoomList
  onForbidden: () => void
  onOpenRequest: (requestId: string) => void
}

// 오른쪽 자리 하나에 여는 패널들: 1:1(022 조각 7), 답글(조각 11), 상품 정보(조각 6). 층은 1:1 < 답글 < 상품 정보다.
// 위 층을 열면 아래 층은 그대로 두고 덮으며, 닫으면 아래 층으로 돌아간다(1:1 방의 원글에 단 답글을 닫으면 그 1:1, 와이어프레임 P-15).
// 아래 층을 열면 위 층은 닫는다(다른 1:1을 열면 답글·상품 정보가 닫히고, 다른 원글의 답글을 열면 상품 정보가 닫힌다).
export function useSidePanels({ onOpenRequest, ...args }: Args) {
  const { councilId, view, team, rooms, onForbidden } = args
  const direct = useDirectPanel(args)
  const reply = useReplyPanel()
  const product = useProductPanel()
  const { close: closeProduct } = product
  const { close: closeReply, open: showReply } = reply
  const opener = useMemo(
    () =>
      direct.opener && {
        ...direct.opener,
        open: (...openArgs: Parameters<NonNullable<typeof direct.opener>['open']>) => {
          closeProduct()
          closeReply()
          direct.opener?.open(...openArgs)
        },
      },
    [direct.opener, closeProduct, closeReply],
  )
  const openReply = useCallback(
    (target: ReplyTarget) => {
      closeProduct()
      showReply(target)
    },
    [closeProduct, showReply],
  )
  const page: RoomPage | null = view && {
    councilId,
    view,
    team,
    rooms,
    onForbidden,
    onOpenRequest,
  }
  let panel: ReactNode = null
  if (page && product.target)
    panel = <ProductPanel page={page} target={product.target} onClose={product.close} />
  else if (page && reply.target)
    panel = <ReplyPanel page={page} target={reply.target} onClose={reply.close} />
  else if (page && direct.target)
    panel = <DirectPanel page={page} target={direct.target} onClose={direct.close} />
  return { opener, openProduct: product.open, openReply, panel }
}

// 패널을 여는 길을 그 아래 화면에 준다.
export function SidePanelOpeners({
  panels,
  children,
}: {
  panels: ReturnType<typeof useSidePanels>
  children: ReactNode
}) {
  return (
    <DirectOpenContext value={panels.opener}>
      <ProductOpenContext value={panels.openProduct}>
        <ReplyOpenContext value={panels.openReply}>{children}</ReplyOpenContext>
      </ProductOpenContext>
    </DirectOpenContext>
  )
}
