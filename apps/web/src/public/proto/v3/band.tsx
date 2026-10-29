import type { ReactNode } from 'react'
import { Banknote, CalendarDays, MapPin, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FormText } from '../form-data'
import { color, radius, size, space, type } from './tokens'

// 페이지 틀: 회색 쟁반 위 가운데 한 단. 390은 폭 전체, 1280은 560px 단.
export function Page({ children }: { children: ReactNode }) {
  return (
    <main className={cn('min-h-dvh', color.tray, space.top, 'sm:pb-10')}>
      <div className={cn('mx-auto flex min-h-dvh w-full flex-col sm:min-h-0', size.column)}>
        {children}
      </div>
    </main>
  )
}

function InfoLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-white/85">{icon}</span>
      <span className="min-w-0 break-keep wrap-anywhere">{children}</span>
    </li>
  )
}

// 머리 띠(신청·받지 않을 때): 행사 색 면에 흰 글자. 학생회 이름(작게) + 마감 알약 → 행사명 → 일시·장소·참가비 세 줄.
// 띠 아래 24px은 흰 시트가 겹쳐 올라와 덮는다. 첫 칸을 밀지 않게 정보는 아이콘 + 한 줄씩만 둔다.
export function EventBand({ text }: { text: FormText }) {
  return (
    <header
      className={cn(
        'relative overflow-hidden pt-5 pb-11',
        space.page,
        color.event,
        color.onEvent,
        radius.band,
      )}
    >
      {/* 친근감용 큰 표 그림(정보 아님, 흐리게). taste 4 */}
      <Ticket
        aria-hidden
        strokeWidth={1.5}
        className="pointer-events-none absolute -right-5 -bottom-5 size-32 -rotate-12 text-white/10"
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className={cn(type.small, 'pt-1 font-medium', color.onEventSoft)}>{text.council}</p>
        {text.deadline && (
          <p
            className={cn(
              type.small,
              'shrink-0 rounded-full bg-white/15 px-2.5 py-1 font-semibold whitespace-nowrap',
            )}
          >
            {text.deadline}
          </p>
        )}
      </div>
      <h1 className={cn(type.title, 'relative mt-1 break-keep wrap-anywhere', color.onEvent)}>
        {text.event}
      </h1>
      <ul className={cn(type.label, 'relative mt-3 flex flex-col gap-1', color.onEventSoft)}>
        <InfoLine icon={<CalendarDays aria-hidden className={size.infoIcon} />}>
          <span className="sr-only">일시 </span>
          {text.when}
        </InfoLine>
        <InfoLine icon={<MapPin aria-hidden className={size.infoIcon} />}>
          <span className="sr-only">장소 </span>
          {text.place ?? '장소 미정'}
        </InfoLine>
        <InfoLine icon={<Banknote aria-hidden className={size.infoIcon} />}>
          <span className="sr-only">참가비 </span>
          {text.fee}
        </InfoLine>
      </ul>
    </header>
  )
}

// 머리 띠 아래로 겹쳐 올라온 흰 시트. 390에서는 화면 끝까지 흰 면이 이어진다.
export function Sheet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative flex flex-1 flex-col bg-white pt-6 pb-10 sm:flex-none sm:rounded-b-[28px]',
        space.page,
        space.overlap,
        radius.sheet,
        className,
      )}
    >
      {children}
    </div>
  )
}
