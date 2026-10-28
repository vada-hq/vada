import {
  menuPath,
  PURCHASE_PENDING_LIMIT,
  PURCHASE_RECENT_LIMIT,
  PURCHASE_VIEWS,
  type CouncilView,
  type PurchaseView,
} from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { navigate, useHere } from '@/lib/app-location'
import { openRecord } from '@/lib/go-to'
import { PURCHASES_LOAD_FAILED } from '@/lib/messages'
import { pickQuery, useMenuQuery } from '@/lib/use-menu-query'
import { useNow } from '@/lib/use-now'
import { PurchasePage } from '@/finance/PurchasePage'
import { neededMarkOf, VIEW_EMPTY } from '@/finance/purchase-view'
import RequestCard from '@/finance/RequestCard'
import { usePurchases, type PurchaseList } from '@/finance/usePurchases'
import { RequestFilter } from './RequestFilter'

type Props = { view: CouncilView; onForbidden: () => void }
const DEFAULT_VIEW = 'mine'
const overflow = (view: PurchaseView) =>
  `요청이 많아서 ${view === 'pending' ? PURCHASE_PENDING_LIMIT : PURCHASE_RECENT_LIMIT}개만 보여요.`

function Body({
  list,
  view,
  onOpen,
}: {
  list: PurchaseList
  view: PurchaseView
  onOpen: (requestId: string) => void
}) {
  const { state } = list
  // 기기 시각이다. 목록 응답에 서버 시각이 없다(홈 응답에만 있다).
  const now = useNow()
  if (state.kind === 'loading')
    return <StateMessage kind="loading">구매 요청 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{PURCHASES_LOAD_FAILED}</StateMessage>
        <Button touch variant="outline" className="self-start" onClick={() => void list.reload()}>
          다시 시도
        </Button>
      </div>
    )
  if (state.requests.length === 0)
    return <StateMessage kind="empty">{VIEW_EMPTY[view]}</StateMessage>
  return (
    <>
      <ul className="flex flex-col gap-2">
        {state.requests.map(request => (
          <li key={request.id}>
            <RequestCard
              request={request}
              mark={view === 'pending' ? neededMarkOf(request.neededBy, now) : null}
              onOpen={() => onOpen(request.id)}
            />
          </li>
        ))}
      </ul>
      {state.truncated && <StateMessage kind="notice">{overflow(view)}</StateMessage>}
    </>
  )
}

// 구매 목록·상세·쓰기는 같은 메뉴에서 열고, 목록 거르기는 주소에 남긴다.
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
  const filter = pickQuery<PurchaseView>(PURCHASE_VIEWS, url.query['view'], DEFAULT_VIEW)
  const list = usePurchases(councilId, filter, onForbidden)
  return (
    <PageColumn>
      {view.permissions.includes('purchase.request') && (
        <Button
          touch
          className="self-start"
          onClick={() => navigate(menuPath('purchases', councilId, { compose: 'new' }))}
        >
          구매 요청 내기
        </Button>
      )}
      <RequestFilter
        view={filter}
        onView={next => url.set({ view: next === DEFAULT_VIEW ? null : next })}
        hasHeads={view.me.departments.some(dept => dept.rank !== null)}
      />
      <Body list={list} view={filter} onOpen={id => openRecord('purchases', councilId, id)} />
    </PageColumn>
  )
}
