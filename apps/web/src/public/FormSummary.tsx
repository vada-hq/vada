import type { PublicRegistrationForm } from '@vada/contracts'
import { momentLabel, whenLabel } from '@/events/event-view'
import { Badge } from '@/components/ui/badge'
import { Fact } from '@/components/Fact'
import { feeText, STATUS_LABEL, STATUS_TONE } from './registration-text'

// 신청 화면 위쪽: 어느 학생회의 무슨 행사인지, 상태, 남은 자리, 신청 마감, 참가비, 안내. 받는 칸은 아래 ApplyFields가 맡는다.
export default function FormSummary({ data }: { data: PublicRegistrationForm }) {
  const { event, form } = data
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs text-gray-500 wrap-anywhere">{data.councilName}</p>
        <h1 className="text-lg font-bold text-gray-900 wrap-anywhere">{event.name}</h1>
        <p className="text-sm text-gray-700 wrap-anywhere">{form.name}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status]}</Badge>
        {data.remaining !== null && data.status === 'open' && (
          <span className="text-xs text-gray-500">남은 자리 {data.remaining}</span>
        )}
      </div>
      <dl className="flex flex-col gap-3">
        {/* 받는 중일 때만. 받지 않을 때는 칸 대신 이유 한 줄(closedLine)이 보인다. */}
        {data.status === 'open' && (
          <Fact label="신청 마감">{`${momentLabel(form.closesAt)}까지`}</Fact>
        )}
        <Fact label="일시">{whenLabel(event)}</Fact>
        {event.place && <Fact label="장소">{event.place}</Fact>}
        <Fact label="참가비">{feeText(data)}</Fact>
      </dl>
      {form.notice && (
        <p className="rounded-md bg-gray-50 p-3 text-sm whitespace-pre-wrap text-gray-700 wrap-anywhere">
          {form.notice}
        </p>
      )}
    </div>
  )
}
