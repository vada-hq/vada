import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy } from 'lucide-react'
import type { CardForm } from '../builder-data'
import type { BuilderProps } from '../builder-props'
import { Empty, LockNote, TextAction } from './parts'
import { size, type } from './tokens'

// 양식 카드 속성 줄의 값 부품: 신청 수, 빠진 값('비어 있음 · 채우기'), 공개 링크·[링크 복사], 받는 항목 한 줄 + 펼치기.

// 출석은 행사 당일부터 뜻이 있어 0이면 숨긴다(명세 3절 허용).
export function CountValue({ item }: { item: CardForm }) {
  const { applicantCount, capacity, attendedCount } = item.form
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className={`${type.focus} text-fg`}>
        {applicantCount}
        {capacity !== null && <span className="font-normal text-fg-muted"> / {capacity}</span>}명
      </span>
      {attendedCount > 0 && <span className="text-fg-muted">출석 {attendedCount}명</span>}
    </span>
  )
}

export function Missing({ onFill }: { onFill: () => void }) {
  return (
    <span className="flex flex-wrap items-center gap-x-1">
      <Empty />
      <span aria-hidden="true" className="text-fg-faint">
        ·
      </span>
      <TextAction strong onClick={onFill}>
        채우기
        <ChevronRight aria-hidden className="-mr-1 size-4" />
      </TextAction>
    </span>
  )
}

export function LinkValue({
  item,
  props,
  main,
}: {
  item: CardForm
  props: BuilderProps
  main: boolean
}) {
  const link = item.text.link!
  const copy = () => {
    void navigator.clipboard?.writeText(link).catch(() => {})
    props.onCopy(item.form.id, link)
  }
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2">
      <span className="min-w-0 truncate text-fg-secondary" title={link}>
        {link.replace('https://', '')}
      </span>
      <TextAction icon={Copy} strong={main} measure="copy-link" onClick={copy}>
        링크 복사
      </TextAction>
    </span>
  )
}

export function Items({ item }: { item: CardForm }) {
  const [open, setOpen] = useState(false)
  const { text } = item
  return (
    <>
      <span className="flex flex-wrap items-center gap-x-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(value => !value)}
          className={`-ml-2 inline-flex ${size.hit} cursor-pointer items-center gap-1 rounded-lg px-2 text-left text-fg-body hover:bg-surface-muted`}
        >
          {text.collected}
          <ChevronDown
            aria-hidden
            className={`size-4 shrink-0 text-fg-muted ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {text.locked && <LockNote>잠김</LockNote>}
      </span>
      {open && (
        <ol className="mt-1 mb-2 flex flex-col border-l-2 border-border-subtle pl-3">
          {text.items.map(entry => (
            <li key={entry.label} className="flex min-h-8 flex-wrap items-center gap-x-2">
              <span className="text-fg-body">{entry.label}</span>
              <span className={`${type.small} text-fg-muted`}>
                {[entry.kind, entry.required ? '필수' : '선택'].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
          {text.locked && (
            <li className="pt-1">
              <LockNote>신청이 있어 항목은 바꿀 수 없어요</LockNote>
            </li>
          )}
        </ol>
      )}
    </>
  )
}
