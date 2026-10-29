import type { ReactNode } from 'react'
import { CircleCheck, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { qrMatrix, qrPath } from '@/lib/qr-code'
import type { FormSample } from '../form-data'
import { color, radius, size, type } from './tokens'

// 입장권(새 부품): 위 칸 = 행사 색 면에 행사명·일시·장소·이름(이름표 + 값, Apple 지갑 r13),
// 좌우 반원 홈 + 점선 절취선(멜론티켓 r10), 아래 칸 = 흰 바탕에 큰 QR과 이름표 '입장 QR'(Eventbrite r09).
// 포스터의 신청 QR은 맨 QR 한 장이라, 틀·이름·용도 줄로 생김새와 이름이 달라 보이게 한다.
// strong = 행사 당일(진한 면 + '오늘' 깃발). 아니면 옅은 면으로 조용히 둔다(때가 되면 앞세움, NOL r11).

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', wide && 'col-span-2')}>
      <dt className={cn(type.small, 'font-medium')}>{label}</dt>
      <dd className={cn(type.label, 'font-semibold break-keep wrap-anywhere')}>{children}</dd>
    </div>
  )
}

function EntryQr({ text, day }: { text: string; day: boolean }) {
  const matrix = qrMatrix(text)
  return (
    // 아래 칸 전체가 흰 바탕이라 QR 둘레 4모듈 이상이 늘 빈다(DENSO). 다크 모드에서도 흰 바탕·검은 점 고정.
    <svg
      role="img"
      aria-label="입장 QR"
      viewBox={`0 0 ${matrix.length} ${matrix.length}`}
      shapeRendering="crispEdges"
      className={cn('aspect-square bg-white', day ? size.qrDay : size.qr)}
    >
      <path d={qrPath(matrix)} className="fill-black" />
    </svg>
  )
}

function Perforation() {
  return (
    <div aria-hidden className="relative h-0">
      <span className={cn('absolute -top-3 -left-3 rounded-full', size.notch, color.tray)} />
      <span className={cn('absolute -top-3 -right-3 rounded-full', size.notch, color.tray)} />
      <span className="absolute inset-x-5 top-0 border-t-2 border-dashed border-border-strong" />
    </div>
  )
}

export default function EntryTicket({ data, strong }: { data: FormSample; strong: boolean }) {
  const { mine, text } = data
  const labelTone = strong ? color.onEventLabel : color.trayText
  // 이름표(dt)만 약한 글자, 값(dd)은 면의 글자색 그대로
  const labelDt = strong ? '[&_dt]:text-white/75' : '[&_dt]:text-fg-tertiary [&_dd]:text-fg'
  return (
    <article
      aria-label="입장권"
      className={cn('relative overflow-hidden bg-white shadow-sm', radius.card)}
    >
      <div
        className={cn(
          'px-5 pt-5 pb-6',
          strong ? cn(color.event, color.onEvent) : cn(color.eventSoft, 'text-fg'),
        )}
      >
        {strong && (
          <p
            className={cn(
              type.small,
              'absolute top-0 right-5 rounded-b-lg bg-white px-3 pt-2 pb-2.5 font-bold',
              color.eventText,
            )}
          >
            오늘
          </p>
        )}
        <p className={cn(type.small, 'font-semibold', labelTone)}>{text.council}</p>
        <h2
          className={cn(
            type.body,
            'mt-0.5 pr-14 font-bold break-keep wrap-anywhere',
            strong ? color.onEvent : color.eventText,
          )}
        >
          {mine.event.name}
        </h2>
        <dl className={cn('mt-4 grid grid-cols-2 gap-x-4 gap-y-3', labelDt)}>
          <Fact label="일시" wide>
            {text.when}
          </Fact>
          <Fact label="장소">{text.place ?? '장소 미정'}</Fact>
          <Fact label="이름">{mine.mine.name}</Fact>
        </dl>
      </div>
      <Perforation />
      <div className="flex flex-col items-center gap-3 px-5 pt-6 pb-6 text-center">
        <h3 className={cn(type.body, 'flex items-center gap-1.5 font-bold text-fg')}>
          <Ticket aria-hidden className="size-5" />
          입장 QR
        </h3>
        {mine.attended ? (
          <p
            className={cn(
              type.body,
              'flex items-center gap-2 rounded-full bg-success-surface px-4 py-2 font-semibold text-success',
            )}
          >
            <CircleCheck aria-hidden className="size-5" />
            출석 확인됨
          </p>
        ) : (
          <EntryQr text={mine.qrText} day={strong} />
        )}
        <p className={cn(type.label, 'text-fg-muted')}>행사 당일 운영진에게 보여 주세요</p>
      </div>
    </article>
  )
}
