import type { MyRegistration } from '@vada/contracts'
import { Fact } from '@/components/Fact'
import QrCode from '@/components/QrCode'
import { Alert } from '@/components/ui/alert'
import { cardClass } from '@/components/ui/card'
import { whenLabel } from '@/events/event-view'
import CopyButton from './CopyButton'
import { won } from './registration-text'

// 출석 뒤에도 행사명과 개인 링크를 남겨 내 신청을 다시 열 수 있게 한다.
export function AttendanceBlock({ mine }: { mine: MyRegistration }) {
  return (
    <section
      aria-label="출석 QR 보관"
      className={`${cardClass} flex flex-col items-center gap-3 p-4`}
    >
      <h2 className="w-full text-center font-semibold break-keep wrap-anywhere">
        {mine.event.name}
      </h2>
      {mine.attended ? (
        <Alert tone="success">출석 확인됨</Alert>
      ) : (
        <>
          {/* 내부 2모듈에 흰 여백 16px를 더해 QR 사방 4모듈 이상을 비운다(DENSO). */}
          <div className="max-w-full bg-white p-4">
            <QrCode text={mine.qrText} label="출석 확인 QR" />
          </div>
          <p className="text-center text-sm break-keep text-muted-foreground">
            행사 당일 이 QR을 보여 주세요.
          </p>
        </>
      )}
      <CopyButton
        value={window.location.href}
        label="주소 복사"
        failedHint="복사하지 못했어요. 길게 눌러 복사해 주세요."
      />
    </section>
  )
}

// 참가비가 0보다 클 때만 계좌가 온다. 서버가 주는 값만 그대로 보인다.
export function FeeBlock({ mine }: { mine: MyRegistration }) {
  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-3">
        <Fact label="참가비">{mine.appliedFee === 0 ? '무료' : won(mine.appliedFee)}</Fact>
        {mine.appliedFee > 0 && (
          <Fact label="입금 상태">{mine.depositConfirmed ? '입금 확인됨' : '입금 확인 전'}</Fact>
        )}
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
      <Fact label="일시">{whenLabel(mine.event)}</Fact>
      {mine.event.place && <Fact label="장소">{mine.event.place}</Fact>}
      <Fact label="이름">{mine.mine.name}</Fact>
      {mine.mine.studentId && <Fact label="학번">{mine.mine.studentId}</Fact>}
      {mine.mine.phone && <Fact label="휴대폰 번호">{mine.mine.phone}</Fact>}
    </dl>
  )
}
