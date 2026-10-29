import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import type { FormText } from '../form-data'
import { radius, shadow, size, space, type } from './tokens'

// 페이지 틀: 면·카드·테두리 없이 흰 화면 전체. 1280에서는 가운데 520px 단.
export function Page({ children }: { children: ReactNode }) {
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full ${size.column} flex-col bg-white ${space.page} pt-8 text-fg break-keep`}
    >
      {children}
    </main>
  )
}

// ① 머리: 작은 회색 학생회 → 큰 굵은 행사명(두 줄까지) → 회색 작은 요약(마감·일시·장소·참가비). 스쳐 읽힌다.
export function EventHead({ text }: { text: FormText }) {
  const facts = [
    text.deadline && `${text.deadline} 신청`,
    text.when,
    text.place ?? '장소 미정',
    text.fee,
  ].filter((fact): fact is string => Boolean(fact))
  return (
    <header className="flex flex-col gap-2">
      <p className={`${type.small} font-medium text-fg-muted`}>{text.council}</p>
      <h1 className={`${type.title} line-clamp-2 wrap-anywhere`}>{text.event}</h1>
      <p className={`${type.label} text-fg-muted`}>
        {facts.map((fact, at) => (
          <span key={fact}>
            {at > 0 && <span aria-hidden="true"> · </span>}
            <span className="wrap-anywhere">{fact}</span>
          </span>
        ))}
      </p>
    </header>
  )
}

// 회색 띠: 구역을 상자 대신 굵은 띠로 가른다(앱 목록 화면의 구분 띠). 단 폭 끝까지 편다.
export function Band() {
  return <div aria-hidden="true" className={`-mx-6 ${space.band} bg-surface-muted`} />
}

// 아래에 붙는 꽉 찬 버튼 자리(TDS FixedBottomCTA). sticky라 내용이 길면 화면 아래에 붙고, 끝까지 내리면 제자리(마지막 내용 뒤)로 온다.
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div
      className={`sticky bottom-0 z-10 -mx-6 flex flex-col gap-2 px-6 pt-6 pb-[max(16px,env(safe-area-inset-bottom))] ${shadow.barFade}`}
    >
      {children}
    </div>
  )
}

type Tone = 'primary' | 'gray'
const BIG_BUTTON: Record<Tone, string> = {
  primary: 'bg-primary-emphasis text-white active:bg-primary-strong',
  gray: 'bg-surface-muted text-fg-secondary active:bg-muted-strong',
}

// 꽉 찬 큰 버튼 56px. 보내는 중에만 막는다.
export function BigButton({
  tone = 'primary',
  busy = false,
  busyLabel,
  children,
  onClick,
  submit = false,
}: {
  tone?: Tone
  busy?: boolean
  busyLabel?: string
  children: ReactNode
  onClick?: () => void
  submit?: boolean
}) {
  return (
    <button
      type={submit ? 'submit' : 'button'}
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center justify-center gap-2 ${size.control} ${radius.control} ${type.body} font-semibold outline-none focus-visible:ring-4 focus-visible:ring-primary-border-strong disabled:cursor-default ${BIG_BUTTON[tone]}`}
    >
      {busy && <Loader2 aria-hidden="true" className="size-5 animate-spin" />}
      {busy ? busyLabel : children}
    </button>
  )
}

// 작은 회색 알약 버튼(주소 복사 같은 곁 행동). 누르는 높이는 44px.
export function QuietButton({
  children,
  onClick,
  label,
}: {
  children: ReactNode
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-start rounded-full bg-surface-muted px-4 ${type.label} font-medium text-fg-secondary outline-none focus-visible:ring-4 focus-visible:ring-primary-border-strong active:bg-muted-strong`}
    >
      {children}
    </button>
  )
}
