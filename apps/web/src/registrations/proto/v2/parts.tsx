import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { FileText, Lock, MoreHorizontal, X } from 'lucide-react'
import { radius, shadow, size, type } from './tokens'

// v2 '문서 한 장 모양'의 작은 부품: 속성 줄, 페이지 아이콘, 상태 점, 글자 버튼, 켜기 끄기, 떠 있는 메뉴, 시트.
// 날것의 button에 모양을 준 까닭: 앱 Button은 테두리·38px 꼴이라 테두리 없는 글자 버튼·속성 줄 값과 맞지 않는다(지시서 '풀린 규칙').

type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>

// 속성 줄(Notion 속성, b15): 왼쪽 회색 아이콘 + 이름표(152px), 오른쪽 값. 상자·테두리 없이 줄 높이로만 나눈다.
// 390에서도 옆에 두되 이름표를 104px로 줄인다(두 줄까지 감김). 값 칸이 약 220px 남는다.
export function PropRow({
  icon: RowIcon,
  label,
  mark,
  htmlFor,
  children,
}: {
  icon: Icon
  label: string
  mark?: 'required' | 'optional'
  htmlFor?: string
  children: ReactNode
}) {
  const Tag = htmlFor ? 'label' : 'div'
  return (
    <div className="flex items-start gap-2 sm:gap-0">
      <Tag
        htmlFor={htmlFor}
        className={`flex ${size.row} items-center gap-2 py-1.5 ${size.label} ${type.body} text-fg-muted`}
      >
        <RowIcon aria-hidden className="size-4 shrink-0" />
        <span className="break-keep">
          {label}
          {mark === 'required' && (
            <span aria-hidden="true" className="ml-0.5 text-danger-emphasis">
              *
            </span>
          )}
          {mark === 'optional' && <span className={`ml-1 ${type.small}`}>(선택)</span>}
        </span>
      </Tag>
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

// 값 자리의 '비어 있음'. 연회색 대신 fg-muted(대비 4.8:1, K5).
export function Empty({ children = '비어 있음' }: { children?: ReactNode }) {
  return <span className="text-fg-muted">{children}</span>
}

// 페이지 아이콘(Notion 페이지 아이콘 자리). 앱 가족의 아이콘 원을 네모 타일로 바꾼 것. 행사 색(범주 3)으로 흑백을 피한다.
export function PageIcon({ large = false }: { large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-xl bg-category-3-soft text-category-3-strong ${large ? size.pageIconLarge : size.pageIcon}`}
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

// 상태 = 점 + 글(알약 대신). 색만으로 말하지 않게 글이 늘 붙는다.
export function StatusMark({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${type.focus} ${DOT_TEXT[tone]}`}>
      <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${DOT[tone]}`} />
      {label}
    </span>
  )
}

// 테두리 없는 글자 버튼(taste-log 2: 줄마다 테두리 버튼 없음). strong이면 강조색 글자.
export function TextAction({
  icon: ActionIcon,
  children,
  strong = false,
  onClick,
  measure,
  label,
}: {
  icon?: Icon
  children: ReactNode
  strong?: boolean
  onClick: () => void
  measure?: string
  label?: string
}) {
  const tone = strong
    ? 'font-semibold text-primary-strong hover:bg-primary-surface'
    : 'font-medium text-fg-secondary hover:bg-surface-muted'
  return (
    <button
      type="button"
      data-measure={measure}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex ${size.hit} shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 ${type.body} ${tone} outline-none focus-visible:ring-2 focus-visible:ring-primary-border-strong pointer-coarse:min-w-11 pointer-coarse:px-3`}
    >
      {ActionIcon && <ActionIcon aria-hidden className="size-4 shrink-0" />}
      {children}
    </button>
  )
}

// 꽉 찬 주 버튼(상태마다 하나). 앱 Button 대신 15px·44px 높이로 문서 글자와 맞춘다.
export function MainButton({
  children,
  onClick,
  submit = false,
  form,
  measure,
  wide = false,
}: {
  children: ReactNode
  onClick?: () => void
  submit?: boolean
  form?: string
  measure?: string
  wide?: boolean
}) {
  return (
    <button
      type={submit ? 'submit' : 'button'}
      form={form}
      data-measure={measure}
      onClick={onClick}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary-emphasis px-5 ${type.body} font-semibold text-white outline-none hover:bg-primary-strong focus-visible:ring-4 focus-visible:ring-primary-border-strong ${wide ? 'w-full' : ''}`}
    >
      {children}
    </button>
  )
}

// 켜기 끄기(받는 항목 학번·휴대폰). 누르는 자리는 44px(터치), 보이는 막대는 36×20.
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
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="inline-flex h-8 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary-border-strong pointer-coarse:h-11"
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${on ? 'justify-end bg-primary-emphasis' : 'justify-start bg-muted-strong'}`}
      >
        <span className="size-4 rounded-full bg-white shadow-sm" />
      </span>
    </button>
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

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close()
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}

export type MenuItem = { label: string; onPick: () => void; on?: boolean; danger?: boolean }

// ••• 메뉴(Notion 폼 b06): 드문 행동을 한 곳에 모은다. 휴대폰에서도 버튼은 늘 보인다.
export function MoreMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useOutside(open, () => setOpen(false))
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className={`inline-flex ${size.iconHit} cursor-pointer items-center justify-center rounded-lg text-fg-muted outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary-border-strong`}
      >
        <MoreHorizontal aria-hidden className="size-5" />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full right-0 z-30 mt-1 flex min-w-44 flex-col rounded-xl bg-white p-1 ${shadow.float}`}
        >
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              role={item.on === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={item.on}
              onClick={() => {
                item.onPick()
                setOpen(false)
              }}
              className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-left ${type.body} outline-none hover:bg-surface-muted focus-visible:bg-surface-muted pointer-coarse:min-h-11 ${item.danger ? 'text-danger' : 'text-fg-body'}`}
            >
              {item.label}
              {item.on !== undefined && (
                <span
                  className={`${type.small} ${item.on ? 'font-semibold text-primary-strong' : 'text-fg-muted'}`}
                >
                  {item.on ? '켬' : '끔'}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// 시트(휴대폰은 아래에서, 데스크탑은 가운데). 미리보기·큰 QR에 쓴다.
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92dvh] w-full flex-col bg-white sm:w-auto sm:min-w-90 ${radius.sheet} rounded-b-none sm:rounded-b-[14px] ${shadow.float}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle py-2 pr-2 pl-5">
          <h2 className={`${type.body} font-semibold text-fg`}>{title}</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className={`inline-flex ${size.iconHit} cursor-pointer items-center justify-center rounded-lg text-fg-muted hover:bg-surface-muted`}
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
