import {
  menuPath,
  PURCHASE_STAGES,
  PURCHASE_VIEWS,
  type CouncilView,
  type PurchaseView,
} from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import { Button } from '@/components/ui/button'
import { navigate, useHere } from '@/lib/app-location'
import { openRecord } from '@/lib/go-to'
import { pickQuery, useMenuQuery } from '@/lib/use-menu-query'
import { PurchasePage } from '@/finance/PurchasePage'
import { usePurchases } from '@/finance/usePurchases'
import { RequestFilter } from './RequestFilter'
import { PurchaseScope } from './PurchaseScope'
import { PurchaseBudget } from './PurchaseBudget'
import { PurchaseStages } from './PurchaseStages'
import { PurchasesBody } from './PurchasesBody'

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
  const canDecide = view.permissions.includes('purchase.approve')
  const defaultView = canDecide ? 'pending' : 'all'
  const filter = pickQuery<PurchaseView>(PURCHASE_VIEWS, url.query['view'], defaultView)
  const scope = url.query['scope']
  const stage = PURCHASE_STAGES.find(value => value === url.query['stage'])
  const list = usePurchases(councilId, filter, onForbidden, { event: scope })
  const create = () =>
    navigate(menuPath('purchases', councilId, { compose: 'new' }), {
      pageState: {
        kind: 'purchase',
        councilId,
        memberId: view.me.memberId,
        eventId: scope === 'none' ? null : scope,
      },
    })
  return (
    <PageColumn>
      {view.permissions.includes('purchase.request') && (
        <Button touch className="self-start" onClick={create}>
          구매 요청 내기
        </Button>
      )}
      <PurchaseScope
        councilId={councilId}
        scope={scope}
        onScope={next => url.set({ scope: next, stage: null })}
        onForbidden={onForbidden}
      />
      <PurchaseBudget councilId={councilId} scope={scope} onForbidden={onForbidden} />
      <RequestFilter
        view={filter}
        onView={next => url.set({ view: next, stage: null })}
        hasDepartments={view.me.departments.length > 0}
        canDecide={canDecide}
      />
      <PurchaseStages
        requests={list.state.kind === 'ready' ? list.state.requests : null}
        stage={stage}
        onStage={next => url.set({ stage: next })}
      />
      <PurchasesBody
        list={list}
        view={filter}
        stage={stage}
        onOpen={id => openRecord('purchases', councilId, id)}
      />
    </PageColumn>
  )
}
