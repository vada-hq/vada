import { useId, useState, type KeyboardEvent } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from './input'

// 고를 것 하나. id가 null이면 '없음'(담당자 없음, 행사 없음 등)이다.
export type Option = {
  id: string | null
  label: string
  // 오른쪽의 흐린 글(사람의 부서 등)
  hint?: string | undefined
  // 왼쪽 색 점의 Tailwind 클래스(부서 색)
  dot?: string | undefined
  // 같은 group이 이어지면 첫 줄 위에 묶음 이름을 단다.
  group?: string | undefined
}

type Props = {
  label: string
  options: Option[]
  value: string | null
  onPick: (id: string | null) => void
  // 주면 위에 찾기 칸을 둔다(사람처럼 많아질 수 있는 목록).
  searchLabel?: string | undefined
}

const keyOf = (id: string | null) => id ?? '__none__'
const STEP: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 }

function useActive(options: Option[], value: string | null) {
  const start = Math.max(
    0,
    options.findIndex(option => option.id === value),
  )
  const [active, setActive] = useState(start)
  const clamped = Math.min(active, Math.max(0, options.length - 1))
  return [clamped, setActive] as const
}

// 고르기 창 안의 목록(WAI-ARIA listbox, 찾기 칸이 있으면 combobox). 위아래 화살표로 옮기고 Enter로 고른다.
// 고르면 부모가 바로 보내고 창을 닫는다. 지금 값에는 체크 표시를 둔다.
export function OptionList({ label, options, value, onPick, searchLabel }: Props) {
  const [query, setQuery] = useState('')
  const shown = query.trim()
    ? options.filter(option => option.label.includes(query.trim()))
    : options
  const [active, setActive] = useActive(shown, value)
  const listId = useId()
  const optionId = (index: number) => `${listId}-${index}`
  const onKeyDown = (event: KeyboardEvent) => {
    const step = STEP[event.key]
    if (step !== undefined) {
      event.preventDefault()
      setActive((active + step + shown.length) % Math.max(1, shown.length))
    }
    const picked = shown[active]
    if (event.key === 'Enter' && picked) {
      event.preventDefault()
      onPick(picked.id)
    }
  }
  const activeId = shown.length > 0 ? optionId(active) : undefined
  return (
    <div className="flex flex-col gap-1" onKeyDown={onKeyDown}>
      {searchLabel !== undefined && (
        <div className="p-1">
          <Input
            role="combobox"
            aria-label={searchLabel}
            aria-controls={listId}
            aria-expanded
            aria-activedescendant={activeId}
            // oxlint-disable-next-line react/forbid-component-props -- 제출과 칸 확인이 없는 검색칸의 짧은 안내만 예외다(AGENTS.md '화면 문구와 폼').
            placeholder={searchLabel}
            value={query}
            onChange={event => {
              setQuery(event.target.value)
              setActive(0)
            }}
          />
        </div>
      )}
      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        aria-activedescendant={searchLabel === undefined ? activeId : undefined}
        tabIndex={searchLabel === undefined ? 0 : -1}
        className="flex max-h-72 flex-col overflow-y-auto outline-none"
      >
        {shown.length === 0 && <li className="px-3 py-2 text-sm text-fg-muted">찾는 이름 없음</li>}
        {shown.map((option, index) => (
          <OptionRow
            key={keyOf(option.id)}
            id={optionId(index)}
            option={option}
            groupStart={option.group !== undefined && option.group !== shown[index - 1]?.group}
            selected={option.id === value}
            active={index === active}
            onHover={() => setActive(index)}
            onPick={() => onPick(option.id)}
          />
        ))}
      </ul>
    </div>
  )
}

type RowProps = {
  id: string
  option: Option
  groupStart: boolean
  selected: boolean
  active: boolean
  onHover: () => void
  onPick: () => void
}

function OptionRow({ id, option, groupStart, selected, active, onHover, onPick }: RowProps) {
  return (
    <>
      {groupStart && (
        <li role="presentation" className="px-3 pt-2 pb-1 text-xs text-fg-muted">
          {option.group}
        </li>
      )}
      <li
        id={id}
        role="option"
        aria-selected={selected}
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-fg-secondary select-none',
          active && 'bg-surface-muted',
        )}
        onMouseMove={onHover}
        onMouseDown={event => event.preventDefault()}
        onClick={onPick}
      >
        {option.dot && (
          <span aria-hidden className={cn('size-2 shrink-0 rounded-full', option.dot)} />
        )}
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
        {option.hint && <span className="shrink-0 text-xs text-fg-subtle">{option.hint}</span>}
        <Check
          aria-hidden
          className={cn('size-4 shrink-0 text-primary-emphasis', !selected && 'invisible')}
        />
      </li>
    </>
  )
}
