import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { RegistrationForm } from '@vada/contracts'
import { Empty, LockNote, TextAction } from './DocParts'
import { type } from './doc-look'
import { collectedItems, collectedSummary } from './form-card-text'

// 양식 카드의 값 부품: 큰 신청 수, 빠진 값('비어 있음 · 채우기'), 받는 항목 한 줄 + 펼치기.

// 머리 띠의 큰 신청 수. 출석은 행사 당일부터 뜻이 있어 0이면 숨긴다(명세 3절 허용).
export function CountValue({ form }: { form: RegistrationForm }) {
  const { applicantCount, capacity, attendedCount } = form
  return (
    <span className="flex flex-wrap items-baseline gap-x-3">
      <span className={`${type.count} text-fg tabular-nums`}>
        신청 {applicantCount}
        {capacity !== null && <span className="font-semibold text-fg-muted"> / {capacity}</span>}명
      </span>
      {attendedCount > 0 && (
        <span className={`${type.body} text-fg-secondary`}>출석 {attendedCount}명</span>
      )}
    </span>
  )
}

// 빠진 조건의 값 자리: '비어 있음 · 채우기 ›'. 채울 권한이 없으면 '비어 있음'만.
export function Missing({ label, onFill }: { label: string; onFill?: (() => void) | undefined }) {
  return (
    <span className="flex flex-wrap items-center gap-x-1">
      <Empty />
      {onFill && (
        <>
          <span aria-hidden="true" className="text-fg-faint">
            ·
          </span>
          <TextAction strong data-fill aria-label={`${label} 채우기`} onClick={onFill}>
            채우기
            <ChevronRight aria-hidden className="-mr-1" />
          </TextAction>
        </>
      )}
    </span>
  )
}

// 받는 항목 한 줄 요약 + 펼치기. 신청이 있으면 질문은 바꾸거나 더할 수 없다(서버 409, DEC-93).
// 질문이 없어도 더하기가 막혀 있으니 잠김을 보인다(편집기의 [질문 추가] 자리 안내와 같은 규칙).
export function CollectedValue({ form }: { form: RegistrationForm }) {
  const [open, setOpen] = useState(false)
  const locked = form.applicantCount > 0
  return (
    <>
      <span className="flex flex-wrap items-center gap-x-3">
        <TextAction
          aria-expanded={open}
          className="-ml-2 text-left whitespace-normal text-fg-body"
          onClick={() => setOpen(value => !value)}
        >
          {collectedSummary(form)}
          <ChevronDown aria-hidden className={`text-fg-muted ${open ? 'rotate-180' : ''}`} />
        </TextAction>
        {locked && <LockNote>신청 있어 질문 잠김</LockNote>}
      </span>
      {open && (
        <ol className="mt-1 mb-2 flex flex-col border-l-2 border-border-subtle pl-3">
          {collectedItems(form).map(item => (
            <li key={item.key} className="flex min-h-8 flex-wrap items-center gap-x-2">
              <span className="text-fg-body wrap-anywhere">{item.label}</span>
              <span className={`${type.small} text-fg-muted`}>
                {[item.kind, item.required ? '필수' : '선택'].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
