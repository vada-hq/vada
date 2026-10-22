import type { MyRegistration } from '@vada/contracts'
import { Fact } from '@/components/Fact'
import QrCode from '@/components/QrCode'
import { Alert } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { whenLabel } from '@/events/event-view'
import CopyButton from './CopyButton'
import { won } from './registration-text'

// 출석 QR 또는 '출석 확인됨'. 취소한 신청은 이 화면에 오지 않으므로 QR은 늘 살아 있는 신청의 것이다.
export function AttendanceBlock({ mine }: { mine: MyRegistration }) {
  if (mine.attended) return <Alert tone="success">출석 확인됨</Alert>
  return (
    <Card className="flex flex-col items-center gap-3 p-4">
      <QrCode text={mine.qrText} label="출석 확인 QR" />
      <p className="text-center text-xs text-gray-500">
        행사장에서 운영진에게 이 QR을 보여 주세요.
      </p>
    </Card>
  )
}

// 참가비가 0보다 클 때만 계좌가 온다. 서버가 주는 값만 그대로 보인다.
export function FeeBlock({ mine }: { mine: MyRegistration }) {
  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-3">
        <Fact label="참가비">{won(mine.appliedFee)}</Fact>
        {mine.account && (
          <>
            <Fact label="입금 계좌">
              {mine.account.bank} {mine.account.accountNumber}
            </Fact>
            <Fact label="예금주">{mine.account.holder}</Fact>
          </>
        )}
      </dl>
      {mine.account && (
        <CopyButton
          value={mine.account.accountNumber}
          label="계좌번호 복사"
          failedHint="복사하지 못했어요. 길게 눌러 복사해 주세요."
        />
      )}
    </div>
  )
}

export function MineFacts({ mine }: { mine: MyRegistration }) {
  return (
    <dl className="flex flex-col gap-3">
      <Fact label="행사">{mine.event.name}</Fact>
      <Fact label="일시">{whenLabel(mine.event)}</Fact>
      {mine.event.place && <Fact label="장소">{mine.event.place}</Fact>}
      <Fact label="이름">{mine.mine.name}</Fact>
      {mine.mine.studentId && <Fact label="학번">{mine.mine.studentId}</Fact>}
      {mine.mine.phone && <Fact label="휴대폰 번호">{mine.mine.phone}</Fact>}
    </dl>
  )
}
