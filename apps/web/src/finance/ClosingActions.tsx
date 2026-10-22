import { useState } from 'react'
import type { Closing } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { ACTION_GONE } from '@/lib/messages'
import { useAskingGuard } from '@/lib/use-asking-guard'
import { ReopenDialog } from './ReopenDialog'
import type { ClosingChange, ClosingOutcome } from './useClosing'

type Asking = 'publish' | 'reopen' | null

// 요청이 값을 바꿨는가(done), 이미 바뀐 값을 다시 읽게 했는가(stale). failed만 아무것도 바꾸지 못했다.
const isApplied = (outcome: ClosingOutcome) => outcome !== 'failed'

type AskProps = {
  change: ClosingChange
  // 서버가 준 동작에 아직 있는가. 확인을 연 동안 빠지면 닫고 이유를 보인다.
  available: boolean
  onClose: () => void
  // 요청이 끝났다(바뀌었거나 이미 바뀐 값을 다시 읽었다). 거절 문구는 지우지 않는다.
  onDone: () => void
  onGone: () => void
}

function PublishAsk({ change, available, onClose, onDone, onGone }: AskProps) {
  const guarded = useAskingGuard(true, available ? null : 'gone', onGone)
  return (
    <ConfirmDialog
      open
      title="결산을 공개할까요?"
      description="공개하면 이 기간은 잠겨서 지출과 수입을 더하거나 취소할 수 없고, 남은 돈이 다음 기간의 이월금 수입이 돼요. 모든 운영진이 결산서를 볼 수 있어요. 공개한 뒤에도 사유를 적고 다시 열 수 있어요."
      confirmLabel="공개"
      busy={change.saving}
      {...(change.problem ? { error: change.problem } : {})}
      onCancel={onClose}
      onConfirm={() =>
        void guarded(change.publish, isApplied).then(outcome => {
          if (isApplied(outcome)) onDone()
        })
      }
    />
  )
}

function ReopenAsk({ change, available, onClose, onDone, onGone }: AskProps) {
  const guarded = useAskingGuard(true, available ? null : 'gone', onGone)
  return (
    <ReopenDialog
      busy={change.saving}
      error={change.problem}
      onClose={onClose}
      onConfirm={reason =>
        void guarded(() => change.reopen(reason), isApplied).then(outcome => {
          if (isApplied(outcome)) onDone()
        })
      }
    />
  )
}

// 공개를 막는 것이 완료하지 않은 행사라면 그 문구가 버튼 자리에 보인다(행사 줄은 점검에 있다). 점검 자체는 공개를 막지 않는다.
function BlockingNotice({ closing, canManage }: { closing: Closing; canManage: boolean }) {
  const count = closing.feePending.blocking.length
  if (!canManage || closing.status !== 'draft' || count === 0) return null
  return (
    <StateMessage kind="notice">
      완료하지 않은 행사 {count}개의 참가비가 아직 수입에 없어요. 아래 점검의 행사를 완료하면 공개할
      수 있어요.
    </StateMessage>
  )
}

type Props = { closing: Closing; change: ClosingChange; canManage: boolean }

// [공개]와 [다시 열기]는 서버가 준 동작에 있을 때만 보인다(화면이 조건을 다시 계산하지 않는다).
// 열려 있는 동안 다시 읽은 동작에서 빠지면 닫고 이유를 보인다. 방금 받은 거절 문구가 있으면 그것을 남긴다.
export function ClosingActions({ closing, change, canManage }: Props) {
  const [asking, setAsking] = useState<Asking>(null)
  const canPublish = closing.actions.includes('closing.publish')
  const canReopen = closing.actions.includes('closing.reopen')
  const close = () => {
    change.report(null)
    setAsking(null)
  }
  const ask = { change, onClose: close, onDone: () => setAsking(null) }
  const onGone = () => {
    setAsking(null)
    change.report(change.problem ?? ACTION_GONE)
  }
  return (
    <div className="flex flex-col items-start gap-2">
      {canPublish && (
        <Button disabled={change.saving} onClick={() => setAsking('publish')}>
          공개
        </Button>
      )}
      {canReopen && (
        <Button variant="outline" disabled={change.saving} onClick={() => setAsking('reopen')}>
          다시 열기
        </Button>
      )}
      <BlockingNotice closing={closing} canManage={canManage} />
      {asking === null && change.problem && (
        <StateMessage kind="error">{change.problem}</StateMessage>
      )}
      {asking === 'publish' && <PublishAsk {...ask} available={canPublish} onGone={onGone} />}
      {asking === 'reopen' && <ReopenAsk {...ask} available={canReopen} onGone={onGone} />}
    </div>
  )
}
