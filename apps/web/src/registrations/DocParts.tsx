import type { ComponentProps, ComponentType, ReactNode } from 'react'
import { FileText, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { size, type } from './doc-look'

// 양식 카드·편집기('문서 한 장 모양')의 작은 부품: 속성 줄, 페이지 아이콘, 상태 점, 글자 버튼, 주 버튼, 켜기 끄기, 잠금 표시.
// 버튼은 components/ui Button 위에 문서 글자 크기·높이를 얹는다(앱 Button 기본 꼴은 테두리·33.5px라 속성 줄 값과 맞지 않는다).

type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>

// 별표·'(선택)'은 라벨 요소 밖에 둔다. 칸 이름이 라벨 글 그대로다(components/ui/field와 같은 까닭).
function Mark({ mark }: { mark: 'required' | 'optional' | undefined }) {
  if (mark === 'required')
    return (
      <span aria-hidden="true" className="ml-0.5 text-danger-emphasis">
        *
      </span>
    )
  return mark === 'optional' ? <span className={`ml-1 ${type.small}`}>(선택)</span> : null
}

// 속성 줄(Notion 속성): 왼쪽 회색 아이콘 + 이름표, 오른쪽 값. 상자·테두리 없이 줄 높이로만 나눈다. 390에서도 옆에 둔다.
export function PropRow({
  icon: RowIcon,
  label,
  mark,
  htmlFor,
  children,
}: {
  icon: Icon
  label: string
  mark?: 'required' | 'optional' | undefined
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-2 sm:gap-0">
      <div
        className={`flex ${size.row} items-center gap-2 py-1.5 ${size.label} ${type.body} text-fg-muted`}
      >
        <RowIcon aria-hidden className="size-4 shrink-0" />
        <span className="break-keep">
          {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
          <Mark mark={mark} />
        </span>
      </div>
      <div
        className={`flex min-w-0 flex-1 flex-col justify-center ${size.row} ${type.body} text-fg-body`}
      >
        {children}
      </div>
    </div>
  )
}

// 칸 아래 오류 한 줄(누른 뒤, 칸과 aria-describedby로 잇는다).
export function ErrorLine({ id, error }: { id: string; error: string | undefined }) {
  if (!error) return null
  return (
    <p id={id} className={`pb-1 ${type.small} font-medium text-danger`}>
      {error}
    </p>
  )
}

// 틀린 칸 표시와 오류 줄 잇기
export const invalid = (id: string, error: string | undefined) => ({
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-error` : undefined,
})

// 값 자리의 '비어 있음'(입력칸 밖 글, placeholder 아님). 흰 바탕 fg-muted 4.8:1.
export function Empty({ children = '비어 있음' }: { children?: ReactNode }) {
  return <span className="text-fg-muted">{children}</span>
}

// 페이지 아이콘(Notion 페이지 아이콘 자리). 행사 색(범주 3)으로 흑백을 피한다.
export function PageIcon({ large = false }: { large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-xl bg-category-3-soft text-category-3-strong ${large ? 'size-12' : 'size-9'}`}
    >
      <FileText className={large ? 'size-6' : 'size-5'} />
    </span>
  )
}

export type Tone = 'draft' | 'open' | 'paused' | 'closed'
const DOT: Record<Tone, string> = {
  draft: 'bg-white ring-2 ring-inset ring-border-strong',
  open: 'bg-success-mark',
  paused: 'bg-warning-mark',
  closed: 'bg-fg-subtle',
}
const DOT_TEXT: Record<Tone, string> = {
  draft: 'text-fg-secondary',
  open: 'text-success',
  paused: 'text-warning',
  closed: 'text-fg-muted',
}

// 상태 = 점 + 글(알약 대신, Notion 속성). 색만으로 말하지 않게 글이 늘 붙는다.
export function StatusMark({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${type.body} font-semibold ${DOT_TEXT[tone]}`}>
      <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${DOT[tone]}`} />
      {label}
    </span>
  )
}

type ButtonProps = Omit<ComponentProps<typeof Button>, 'variant' | 'size'> & { icon?: Icon }

// 테두리 없는 글자 버튼(taste-log 2: 줄마다 테두리 버튼 없음). strong이면 강조색 글자.
export function TextAction({
  icon: ActionIcon,
  strong = false,
  className,
  children,
  ...props
}: ButtonProps & { strong?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        `${size.hit} gap-1.5 rounded-lg px-2 py-0 ${type.body} pointer-coarse:min-w-11 pointer-coarse:px-3`,
        strong
          ? 'font-semibold text-primary-strong hover:bg-primary-surface hover:text-primary-strong'
          : 'font-medium text-fg-secondary hover:bg-surface-muted hover:text-fg-secondary',
        className,
      )}
      {...props}
    >
      {ActionIcon && <ActionIcon aria-hidden />}
      {children}
    </Button>
  )
}

// 꽉 찬 주 버튼 44px(상태마다 하나).
export function MainButton({ icon: ActionIcon, className, children, ...props }: ButtonProps) {
  return (
    <Button
      type="button"
      className={cn(
        `min-h-11 rounded-xl bg-primary-emphasis px-5 ${type.body} font-semibold text-white hover:bg-primary-strong`,
        className,
      )}
      {...props}
    >
      {ActionIcon && <ActionIcon aria-hidden />}
      {children}
    </Button>
  )
}

// 옅은 회색 면 버튼 44px: 아직 주 행동이 아닌 것(조건이 덜 찬 [설문 링크 활성화], 멈춤·종료의 [링크 복사]). 끄지 않는다.
export function SoftButton({ icon: ActionIcon, className, children, ...props }: ButtonProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      className={cn(
        `min-h-11 rounded-xl bg-surface-muted px-4 ${type.body} font-semibold text-fg-secondary hover:bg-muted-strong`,
        className,
      )}
      {...props}
    >
      {ActionIcon && <ActionIcon aria-hidden />}
      {children}
    </Button>
  )
}

// 켜기 끄기(받는 항목 학번·휴대폰). 누르는 자리는 데스크탑 32px·터치 44px, 보이는 막대는 36×20.
export function Switch({
  on,
  label,
  onChange,
}: {
  on: boolean
  label: string
  onChange: (on: boolean) => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="h-8 w-11 rounded-full p-0 hover:bg-transparent pointer-coarse:h-11"
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${on ? 'justify-end bg-primary-emphasis' : 'justify-start bg-muted-strong'}`}
      >
        <span className="size-4 rounded-full bg-white shadow-sm" />
      </span>
    </Button>
  )
}

// 잠금 표시: 자물쇠 + 짧은 글(색만으로 말하지 않기).
export function LockNote({ children }: { children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 ${type.small} text-fg-muted`}>
      <Lock aria-hidden className="size-3.5 shrink-0" />
      {children}
    </span>
  )
}
