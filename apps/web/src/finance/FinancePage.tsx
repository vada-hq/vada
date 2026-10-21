import { useState } from 'react'
import {
  PURCHASE_PENDING_LIMIT,
  PURCHASE_RECENT_LIMIT,
  type CouncilView,
  type PurchaseView,
} from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { PURCHASES_LOAD_FAILED } from '@/lib/messages'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import { FinanceTabs } from './FinanceTabs'
import { VIEW_EMPTY } from './purchase-view'
import RequestCard from './RequestCard'
import { RequestCreateDialog } from './RequestCreateDialog'
import { RequestDetailDialog } from './RequestDetailDialog'
import { usePurchases, type PurchaseList } from './usePurchases'

const overflow = (view: PurchaseView) =>
  `요청이 많아서 ${view === 'pending' ? PURCHASE_PENDING_LIMIT : PURCHASE_RECENT_LIMIT}개만 보여요.`

type Props = {
  view: CouncilView
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다. 운영진이 아니게 되었으면 학생회를 닫는다.
  onForbidden: () => void
  // 목록이 바뀌었을 때(옆 메뉴의 결재 대기 수를 다시 읽는다).
  onChanged: () => void
}

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
  if (state.kind === 'loading')
    return <StateMessage kind="loading">구매 요청 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{PURCHASES_LOAD_FAILED}</StateMessage>
        <Button variant="outline" className="self-start" onClick={() => void list.reload()}>
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
            <RequestCard request={request} onOpen={() => onOpen(request.id)} />
          </li>
        ))}
      </ul>
      {state.truncated && <StateMessage kind="notice">{overflow(view)}</StateMessage>}
    </>
  )
}

// 내기 버튼과, 열려 있던 요청을 잃었을 때의 이유(좁은 화면에서도 버튼 바로 옆에 보인다).
function CreateRow({ lost, onCreate }: { lost: string | null; onCreate: (() => void) | null }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {onCreate && <Button onClick={onCreate}>구매 요청 내기</Button>}
      {lost && <StateMessage kind="error">{lost}</StateMessage>}
    </div>
  )
}

// 옆 메뉴 '재정': 구매 요청 탭과 거르기 셋(내 요청, 결재 대기, 전체). 거르기를 바꾸면 이전 거르기의 늦은 응답은 버린다.
export default function FinancePage(props: Props) {
  const [filter, setFilter] = useState<PurchaseView>('mine')
  const dialogs = useRecordDialogs()
  const councilId = props.view.council.id
  const list = usePurchases(councilId, filter, props.onForbidden)
  const changed = () => {
    void list.reload()
    props.onChanged()
  }
  const lose = (message: string) => {
    dialogs.lose(message)
    changed()
  }
  const canRequest = props.view.permissions.includes('purchase.request')
  return (
    <PageColumn>
      <CreateRow lost={dialogs.lost} onCreate={canRequest ? dialogs.startCreate : null} />
      <RequestDetailDialog
        councilId={councilId}
        requestId={dialogs.openId}
        onClose={dialogs.closeDetail}
        onChanged={changed}
        onLost={lose}
        onForbidden={props.onForbidden}
      />
      <RequestCreateDialog
        councilId={councilId}
        open={dialogs.creating}
        onClose={dialogs.closeCreate}
        onCreated={() => {
          changed()
          dialogs.closeCreate()
        }}
        onLost={lose}
        onForbidden={props.onForbidden}
      />
      <FinanceTabs view={filter} onView={setFilter} />
      <div role="tabpanel" className="flex flex-col gap-3">
        <Body list={list} view={filter} onOpen={dialogs.openRecord} />
      </div>
    </PageColumn>
  )
}
