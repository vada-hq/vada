import type { ChatMessage, TeamResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { useDialogGuard } from '@/lib/use-dialog-guard'
import { RequestCreateDialog } from '../finance/RequestCreateDialog'
import { requestSeedOf } from './request-seed'
import type { RequestFlow } from './useRequestFlow'

export type RequestAccess = {
  // 지금 운영진. 아직 못 읽었으면 null이다.
  team: TeamResponse | null
  // 받은 권한 목록의 값을 그대로 쓴다(화면이 다시 계산하지 않는다).
  canRequest: boolean
  canAssign: boolean
  onOpenRequest: (requestId: string) => void
}

type Props = Omit<RequestAccess, 'onOpenRequest'> & {
  councilId: string
  meId: string
  flow: RequestFlow
  onForbidden: () => void
}

// 재정부는 나 말고 다른 지금 운영진도 요청한 사람으로 고른다.
function requestersOf(team: TeamResponse | null, meId: string) {
  const others = (team?.members ?? []).filter(member => member.id !== meId)
  return [
    { id: meId, label: '나' },
    ...others.map(member => ({ id: member.id, label: member.name })),
  ]
}

function Dialog({ message, ...props }: Props & { message: ChatMessage | null }) {
  const { flow, councilId, meId, team, canAssign } = props
  // 열려 있는 동안 권한을 잃으면 닫고 이유를 보인다.
  useDialogGuard(message !== null, props.canRequest ? null : PERMISSION_CHANGED, flow.lose)
  if (message === null) return null
  const seed = requestSeedOf(message, { meId, members: team?.members ?? null, canAssign })
  return (
    <RequestCreateDialog
      open
      councilId={councilId}
      start={seed}
      requesters={canAssign ? requestersOf(team, meId) : null}
      onClose={flow.close}
      onCreated={request => flow.finish(request.id)}
      onLost={flow.lose}
      onForbidden={props.onForbidden}
    />
  )
}

// 대화상자와, 닫힌 뒤의 안내(낸 요청 보기, 잃은 이유).
export default function RequestFlowView({
  onOpenRequest,
  ...props
}: Props & Pick<RequestAccess, 'onOpenRequest'>) {
  const { flow } = props
  return (
    <>
      <Dialog {...props} message={flow.requesting} />
      {flow.lost && <StateMessage kind="notice">{flow.lost}</StateMessage>}
      {flow.madeId && (
        <div className="flex flex-wrap items-center gap-2">
          <StateMessage kind="notice">구매 요청을 냈어요.</StateMessage>
          <Button
            variant="outline"
            size="sm"
            onClick={() => flow.madeId && onOpenRequest(flow.madeId)}
          >
            재정에서 보기
          </Button>
          <Button variant="ghost" size="sm" onClick={flow.dismiss}>
            닫기
          </Button>
        </div>
      )}
    </>
  )
}
