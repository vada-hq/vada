import { useState } from 'react'
import type { MyRegistration } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { REGISTRATION_LOAD_FAILED, REGISTRATION_LOST } from '@/lib/registration-messages'
import { AttendanceBlock, FeeBlock, MineFacts } from './MineDetails'
import { useMyRegistration } from './useMyRegistration'

type Cancel = { busy: boolean; problem: string; run: () => Promise<void> }

function CancelBlock({ cancel }: { cancel: Cancel }) {
  const [asking, setAsking] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" touch className="self-start" onClick={() => setAsking(true)}>
        신청 취소
      </Button>
      <ConfirmDialog
        open={asking}
        title="신청을 취소할까요?"
        description="취소하면 낸 이름과 연락처가 지워지고, 이 주소로 다시 볼 수 없어요. 마감 전이면 다시 신청할 수 있어요."
        confirmLabel="신청 취소"
        destructive
        busy={cancel.busy}
        onConfirm={() => {
          void cancel.run().then(() => setAsking(false))
        }}
        onClose={() => setAsking(false)}
      />
    </div>
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
      {mine.cancellable && <CancelBlock cancel={cancel} />}
      {/* 취소 오류는 취소 버튼이 사라져도(마감이 지나 cancellable이 false가 되면) 이유와 함께 남는다. */}
      {cancel.problem && <StateMessage kind="error">{cancel.problem}</StateMessage>}
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
