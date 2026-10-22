import { useState } from 'react'
import type { MyRegistration } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { REGISTRATION_LOAD_FAILED, REGISTRATION_LOST } from '@/lib/messages'
import CopyButton from './CopyButton'
import { AttendanceBlock, FeeBlock, MineFacts } from './MineDetails'
import { dateText } from './registration-text'
import { useMyRegistration } from './useMyRegistration'

type Cancel = { busy: boolean; problem: string; run: () => Promise<void> }

function CancelBlock({ cancel }: { cancel: Cancel }) {
  const [asking, setAsking] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" className="self-start" onClick={() => setAsking(true)}>
        신청 취소
      </Button>
      {cancel.problem && <StateMessage kind="error">{cancel.problem}</StateMessage>}
      <ConfirmDialog
        open={asking}
        title="신청을 취소할까요?"
        description="취소하면 낸 이름과 연락처가 지워지고, 이 주소로 다시 볼 수 없어요. 마감 전이면 다시 신청할 수 있어요."
        confirmLabel="취소하기"
        destructive
        busy={cancel.busy}
        onConfirm={() => {
          void cancel.run().then(() => setAsking(false))
        }}
        onCancel={() => setAsking(false)}
      />
    </div>
  )
}

// 이 주소(#뒤 토큰)가 곧 열쇠다. 잃으면 내 신청을 다시 볼 수 없으므로 저장을 권한다.
function SaveAddress() {
  return (
    <Alert tone="info" className="flex flex-col gap-2">
      <span>
        이 주소를 저장해 두세요. 행사장에서 이 주소로 QR을 다시 열어요. 다른 사람에게 보내지 마세요.
      </span>
      <CopyButton
        value={window.location.href}
        label="주소 복사"
        failedHint="복사하지 못했어요. 길게 눌러 복사해 주세요."
      />
    </Alert>
  )
}

function Ready({ mine, cancel }: { mine: MyRegistration; cancel: Cancel }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs text-gray-500 wrap-anywhere">{mine.councilName}</p>
        <h1 className="text-lg font-bold text-gray-900">내 신청</h1>
      </div>
      <AttendanceBlock mine={mine} />
      <MineFacts mine={mine} />
      <FeeBlock mine={mine} />
      <SaveAddress />
      {mine.cancellable && <CancelBlock cancel={cancel} />}
      <p className="text-xs text-gray-500">신청 정보는 {dateText(mine.purgeOn)}에 지워져요.</p>
    </div>
  )
}

// 개인 링크(/r#토큰)로 여는 내 신청. 로그인이 없다.
export default function MyRegistrationPage({ token }: { token: string }) {
  const { state, busy, problem, cancel, retry } = useMyRegistration(token)
  switch (state.kind) {
    case 'loading':
      return <StateMessage kind="loading">불러오는 중…</StateMessage>
    case 'lost':
      return <StateMessage kind="error">{REGISTRATION_LOST}</StateMessage>
    case 'cancelled':
      return <Alert tone="success">신청을 취소했어요.</Alert>
    case 'failed':
      return (
        <div className="flex flex-col items-start gap-2">
          <StateMessage kind="error">{REGISTRATION_LOAD_FAILED}</StateMessage>
          <Button variant="outline" onClick={retry}>
            다시 시도
          </Button>
        </div>
      )
    case 'ready':
      return <Ready mine={state.data} cancel={{ busy, problem, run: cancel }} />
  }
}
