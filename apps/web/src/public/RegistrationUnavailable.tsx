import { CalendarX2, Clock, Pause, Users, type LucideIcon } from 'lucide-react'
import type { PublicRegistrationForm, RegistrationStatus } from '@vada/contracts'
import { BigButton, BottomBar } from './BottomBar'
import { type } from './public-look'
import { closedLine, STATUS_LABEL } from './registration-text'

// 상태마다 아이콘. 색은 객관적 사실(다 참)에만 주고 나머지는 중립 회색이다(내용: 정보 기준).
const LOOK: Record<Exclude<RegistrationStatus, 'open'>, { icon: LucideIcon; tone: string }> = {
  full: { icon: Users, tone: 'bg-pending-surface text-pending-emphasis' },
  before_open: { icon: Clock, tone: 'bg-surface-muted text-fg-tertiary' },
  paused: { icon: Pause, tone: 'bg-surface-muted text-fg-tertiary' },
  closed: { icon: CalendarX2, tone: 'bg-surface-muted text-fg-tertiary' },
}

// 받지 않을 때: 신청 칸 자리(머리 바로 아래, 첫 칸과 같은 40px 뒤)에 상자 없이 아이콘 원 → 제목 → 한 줄.
// 빈 자리 가운데에 띄우지 않아 첫눈에 신청할 수 없음이 읽힌다. 버튼은 휴대폰에서 화면 아래, 넓은 화면에서는 바로 아래다.
export default function RegistrationUnavailable({ data }: { data: PublicRegistrationForm }) {
  if (data.status === 'open') return null
  const title = STATUS_LABEL[data.status]
  const { icon: Icon, tone } = LOOK[data.status]
  return (
    <section aria-label={title} className="flex flex-1 flex-col break-keep wrap-anywhere">
      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <span className={`flex size-16 items-center justify-center rounded-full ${tone}`}>
          <Icon aria-hidden="true" className="size-8" strokeWidth={2.25} />
        </span>
        <h2 className={`mt-2 ${type.body} font-bold text-fg`}>{title}</h2>
        <p className={`${type.label} text-fg-tertiary`}>{closedLine(data)}</p>
      </div>
      <BottomBar className="mt-auto sm:mt-10">
        <BigButton tone="gray" onClick={() => window.history.back()}>
          돌아가기
        </BigButton>
      </BottomBar>
    </section>
  )
}
