import { menuPath, type CouncilView } from '@vada/contracts'
import PageActions from '@/components/PageActions'
import PageColumn from '@/components/PageColumn'
import { navigate, useHere } from '@/lib/app-location'
import { openRecord } from '@/lib/go-to'
import { useMenuQuery } from '@/lib/use-menu-query'
import { PurchasePage } from '@/finance/PurchasePage'
import { usePurchases } from '@/finance/usePurchases'
import { MyPurchaseRequests } from './MyPurchaseRequests'
import { PurchaseBudget } from './PurchaseBudget'
import { PurchaseHeadActions } from './PurchaseHeadActions'
import { PurchaseScope } from './PurchaseScope'
import { PurchaseWork } from './PurchaseWork'
import { usePurchaseBoardQuery, whoOf } from './purchase-board-query'

type Props = { view: CouncilView; onForbidden: () => void }

export default function PurchasesPage(props: Props) {
  const { location } = useHere()
  const active = location?.councilId === props.view.council.id.toLowerCase()
  if (active && location?.type === 'record' && location.record === 'purchases')
    return <PurchasePage {...props} requestId={location.recordId} />
  if (active && location?.type === 'menu' && location.query['compose'] === 'new')
    return <PurchasePage {...props} />
  return <PurchasesList {...props} />
}

function PurchasesList({ view, onForbidden }: Props) {
  const councilId = view.council.id
  const url = useMenuQuery('purchases', councilId)
  const board = usePurchaseBoardQuery(view, url.query)
  const scope = url.query['scope']
  const list = usePurchases(councilId, board.fetchView, onForbidden, { event: scope })
  const canRequest = view.permissions.includes('purchase.request')
  const create = () =>
    navigate(menuPath('purchases', councilId, { compose: 'new' }), {
      pageState: {
        kind: 'purchase',
        councilId,
        memberId: view.me.memberId,
        eventId: scope === 'none' ? null : scope,
      },
    })
  const open = (id: string) => openRecord('purchases', councilId, id)
  if (board.page === 'mine')
    return (
      <PageColumn>
        <MyPurchaseRequests
          requests={list.state.kind === 'ready' ? list.state.requests : []}
          who={whoOf(view)}
          onBack={() => url.set({ page: null })}
          onCreate={canRequest ? create : null}
          onOpen={open}
        />
      </PageColumn>
    )
  return (
    <PageColumn>
      <PageActions>
        <PurchaseHeadActions
          onMine={() => url.set({ page: 'mine' })}
          onCreate={canRequest ? create : null}
        />
      </PageActions>
      <PurchaseScope
        councilId={councilId}
        scope={scope}
        onScope={next => url.set({ scope: next })}
        onForbidden={onForbidden}
      />
      <PurchaseBudget councilId={councilId} scope={scope} onForbidden={onForbidden} />
      <PurchaseWork
        list={list}
        canProcess={board.canProcess}
        board={board.board}
        area={board.area}
        view={board.view}
        onBoard={next => url.set({ board: next })}
        onArea={next => url.set({ area: next })}
        onView={next => url.set({ view: next })}
        showEvent={!scope || scope === 'none'}
        onOpen={open}
      />
    </PageColumn>
  )
}
