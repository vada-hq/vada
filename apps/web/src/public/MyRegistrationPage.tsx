import type { MyRegistration } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { REGISTRATION_LOAD_FAILED, REGISTRATION_LOST } from '@/lib/registration-messages'
import { Toast, useCopy } from './copy-toast'
import { EntryQrHero, EntryQrRow } from './EntryQr'
import { useEventDay } from './event-day'
import { MineFooter, type Cancel } from './MineFooter'
import { AccountPanel, DayResult, Result } from './MineResult'
import { Band } from './PageParts'
import { useMyRegistration } from './useMyRegistration'

// 신청 직후·내 신청. 차례: 완료 → 참가비·계좌 → 입장 QR → 행사 정보·문의 → 다시 열기 → 취소 → 지우는 날(내용 ④).
// 행사 당일(day)에는 입장 QR이 맨 위로 오고, 낼 돈이 남지 않았으면 완료와 계좌를 두 줄로 접는다.
export function MyRegistrationView({
  mine,
  day,
  cancel,
}: {
  mine: MyRegistration
  day: boolean
  cancel: Cancel
}) {
  const copy = useCopy()
  const settled = day && (mine.appliedFee === 0 || mine.depositConfirmed)
  return (
    <div className="flex flex-col break-keep">
      <div className={day ? 'flex flex-col gap-6 pb-8' : 'flex flex-col gap-6 pt-6 pb-8'}>
        {day && <EntryQrHero mine={mine} />}
        {day && <Band />}
        {settled ? <DayResult mine={mine} /> : <Result mine={mine} compact={day} />}
        {!settled && <AccountPanel mine={mine} copy={copy} />}
        {!day && <EntryQrRow mine={mine} />}
      </div>
      <Band />
      <MineFooter mine={mine} cancel={cancel} copy={copy} />
      <Toast message={copy.message} />
    </div>
  )
}

// 개인 링크(/r#토큰)로 여는 내 신청. 로그인이 없다.
export default function MyRegistrationPage({ token }: { token: string }) {
  const { state, busy, problem, cancel, retry } = useMyRegistration(token)
  const day = useEventDay(state.kind === 'ready' ? state.data : null)
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
          <Button variant="outline" touch onClick={retry}>
            다시 시도
          </Button>
        </div>
      )
    case 'ready':
      return (
        <MyRegistrationView
          mine={state.data}
          day={day}
          cancel={{ busy, problem, run: cancel }}
        />
      )
  }
}
