import { ArrowRight, Ban, CalendarX2, Clock, Pause, Users, type LucideIcon } from 'lucide-react'
import type { ClosedDataName, FormClosed } from '../form-data'
import type { FormProps } from '../form-props'
import { BigButton, BottomBar, EventHead, Page } from './parts'
import { size, type } from './tokens'

// 상태마다 아이콘. 강조는 객관적 사실(다 참·바뀜)에만 색을 주고 나머지는 중립 회색(내용: 정보 기준).
const LOOK: Record<ClosedDataName, { icon: LucideIcon; tone: string }> = {
  full: { icon: Users, tone: 'bg-pending-surface text-pending-emphasis' },
  before: { icon: Clock, tone: 'bg-surface-muted text-fg-tertiary' },
  paused: { icon: Pause, tone: 'bg-surface-muted text-fg-tertiary' },
  ended: { icon: CalendarX2, tone: 'bg-surface-muted text-fg-tertiary' },
  cancelled: { icon: Ban, tone: 'bg-surface-muted text-fg-tertiary' },
  moved: { icon: ArrowRight, tone: 'bg-primary-surface text-primary-emphasis' },
}

// ⑤ 받지 않을 때: 칸 자리(행사 요약 바로 아래, 신청 화면의 첫 칸과 같은 40px 뒤)에 Result 꼴 상태
// (아이콘 원 → 제목 → 한 줄). 빈 자리 가운데에 띄우지 않아 첫눈에 신청할 수 없음이 읽힌다.
function StatusResult({ closed }: { closed: FormClosed }) {
  const { icon: Icon, tone } = LOOK[closed.kind]
  return (
    <section aria-label={closed.title} className="mt-10 flex flex-col items-center gap-3 text-center">
      <span className={`flex ${size.resultIcon} items-center justify-center rounded-full ${tone}`}>
        <Icon aria-hidden="true" className="size-8" strokeWidth={2.25} />
      </span>
      <h2 className={`mt-2 ${type.body} font-bold`}>{closed.title}</h2>
      <p className={`${type.label} text-fg-tertiary`}>{closed.line}</p>
    </section>
  )
}

export default function ClosedScreen({ data, onClosedAction }: FormProps) {
  const closed = data.closed
  if (!closed) return null
  const moved = closed.action.href !== null
  return (
    <Page>
      <EventHead text={data.text} />
      <div className="flex flex-1 flex-col">
        <StatusResult closed={closed} />
        {/* 휴대폰은 버튼을 화면 아래에 붙이고, 1280은 상태 바로 아래에 둔다. */}
        <BottomBar className="mt-auto sm:mt-10">
          <BigButton tone={moved ? 'primary' : 'gray'} onClick={onClosedAction}>
            {closed.action.label}
          </BigButton>
        </BottomBar>
      </div>
    </Page>
  )
}
