import { useState } from 'react'
import { menuPath, recordPath, type CouncilView } from '@vada/contracts'
import PageHeading from '@/components/PageHeading'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { leave, navigate, useHere } from '@/lib/app-location'
import { openMenu, openRecord } from '@/lib/go-to'
import { useTeam } from '@/team/useTeam'
import { purchaseDraftOf, type PurchaseDraft } from './purchase-draft'
import { RequestCreatePage } from './RequestCreateDialog'
import { RequestDetailPage } from './RequestDetailDialog'

type Props = { view: CouncilView; onForbidden: () => void; requestId?: string }

function CreatePage({
  view,
  onForbidden,
  onLost,
  onClose,
}: Omit<Props, 'requestId'> & {
  onLost: (message: string) => void
  onClose: () => void
}) {
  const canAssign = view.permissions.includes('finance.manage')
  const team = useTeam(view.council.id, onForbidden, canAssign)
  const [draft] = useState(() => purchaseDraftOf(view.council.id, view.me.memberId))
  if (!view.permissions.includes('purchase.request'))
    return <StateMessage kind="notice">구매 요청을 낼 권한이 없어요.</StateMessage>
  // 대신 낼 사람을 숨긴 채 제출하지 않도록 현재 명단이 준비된 뒤 양식을 연다.
  if (canAssign && !team.data)
    return <RequesterLoading failed={team.loadFailed} onRetry={team.reload} />
  const requesters =
    canAssign && team.data
      ? [
          { id: view.me.memberId, label: '나' },
          ...team.data.members
            .filter(member => member.id !== view.me.memberId)
            .map(member => ({ id: member.id, label: member.name })),
        ]
      : null
  return (
    <RequestCreatePage
      councilId={view.council.id}
      memberId={view.me.memberId}
      {...initialPropsOf(draft)}
      requesters={requesters}
      onClose={onClose}
      onLost={onLost}
      onForbidden={onForbidden}
      onCreated={request =>
        navigate(recordPath('purchases', view.council.id, request.id), {
          replace: true,
          force: true,
        })
      }
    />
  )
}

export function PurchasePage({ view, requestId, onForbidden }: Props) {
  const here = useHere()
  const [lost, setLost] = useState<string | null>(null)
  const councilId = view.council.id
  const back = () => leave(menuPath('purchases', councilId))
  return (
    <div className="flex flex-col gap-5">
      <Button touch variant="ghost" className="self-start" onClick={back}>
        {here.from ? '들어온 곳으로 돌아가기' : '구매'}
      </Button>
      {lost ? (
        <>
          <PageHeading
            trail={{ title: '구매 요청', crumbs: [{ label: '구매 요청', truncate: false }] }}
          >
            <h1 className="text-xl font-semibold">구매 요청</h1>
          </PageHeading>
          <StateMessage kind="error">{lost}</StateMessage>
        </>
      ) : requestId ? (
        <RequestDetailPage
          councilId={councilId}
          requestId={requestId}
          onClose={back}
          onChanged={() => {}}
          onLost={setLost}
          onForbidden={onForbidden}
          onOpenBudget={() => openMenu('finance', councilId, { tab: 'budget' })}
          onOpenExpense={id => openRecord('expenses', councilId, id, { overRecord: true })}
        />
      ) : (
        <CreatePage
          key={`${councilId}:${view.me.memberId}`}
          view={view}
          onForbidden={onForbidden}
          onLost={setLost}
          onClose={back}
        />
      )}
    </div>
  )
}

function initialPropsOf(draft: PurchaseDraft | null) {
  return {
    ...(draft?.eventId !== undefined ? { eventId: draft.eventId } : {}),
    ...(draft?.taskId ? { taskId: draft.taskId } : {}),
    ...(draft?.pickTask ? { pickTask: true } : {}),
    ...(draft?.start ? { start: draft.start } : {}),
  }
}

function RequesterLoading({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <PageHeading
        trail={{
          title: '구매 요청 내기',
          crumbs: [
            { label: '구매 요청', truncate: false },
            { label: '새 요청', truncate: false },
          ],
        }}
      >
        <h1 className="text-xl font-semibold">구매 요청 내기</h1>
      </PageHeading>
      <StateMessage kind={failed ? 'error' : 'loading'}>
        {failed ? '요청한 사람 목록을 읽지 못했어요.' : '요청한 사람 목록을 불러오는 중이에요.'}
      </StateMessage>
      {failed && (
        <Button variant="outline" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  )
}
