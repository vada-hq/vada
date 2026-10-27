import { useId, useRef, type ReactNode } from 'react'
import { Ellipsis } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { isComposingKey } from '@/lib/composing-key'
import { cn } from '@/lib/utils'
import type { DepartmentRow } from './useDepartmentEditing'

type Props = {
  row: DepartmentRow
  // 이름 칸의 이름('재정 부서 이름', '부서 이름 1'). 칸은 고칠 때와 이름에 문제가 있을 때만 보인다.
  label: string
  name: string
  editing: boolean
  error: string | undefined
  onStart: () => void
  onEnter: () => void
  onRename: (name: string) => void
  nameSuggestions?: string[] | undefined
  onChooseName: (name: string) => void
  onCommit: (refocus: boolean) => void
  onCancel: () => void
  // 재정 부서는 뺄 수 없어 없다.
  onRemove?: (() => void) | undefined
}

// 조직도의 부서 카드(와이어프레임 ORG-02): 이름과 오른쪽 위 ⋯ 메뉴(이름 바꾸기·빼기), 재정 역할 부서는 '재정' 표시.
// 이름 바꾸기는 카드 안 제자리 편집이다. 이름을 누르거나 ⋯ 메뉴의 '이름 바꾸기'로 열고, Enter 저장, Esc 취소(Atlassian inline edit).
export default function DepartmentCard({
  row,
  label,
  name,
  editing,
  error,
  nameSuggestions,
  ...on
}: Props) {
  const errorId = useId()
  const showInput = editing || error !== undefined
  const financeBadge = row === 'finance' && (
    <Badge tone="info" className="w-fit">
      재정
    </Badge>
  )
  return (
    <div
      className={cn(cardClass, 'flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-3')}
      onBlur={event => {
        // 이름 후보로 초점을 옮길 때 칸을 닫으면 누르기 전에 후보가 사라진다.
        if (!event.currentTarget.contains(event.relatedTarget)) on.onCommit(false)
      }}
    >
      {showInput ? (
        <>
          <Input
            aria-label={label}
            aria-required
            value={name}
            data-row={row}
            className="px-2"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={event => on.onRename(event.target.value)}
            onFocus={on.onEnter}
            onKeyDown={event => {
              // 한글 조합을 끝내는 Enter는 저장이 아니다.
              if (isComposingKey(event)) return
              if (event.key === 'Enter') {
                event.preventDefault()
                on.onCommit(true)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                on.onCancel()
              }
            }}
          />
          {error && (
            <p id={errorId} className="text-xs text-red-600">
              {error}
            </p>
          )}
          {nameSuggestions && (
            <div role="group" aria-label="재정 부서 이름 후보" className="flex flex-wrap gap-1.5">
              {nameSuggestions.map(candidate => (
                <Button
                  key={candidate}
                  type="button"
                  variant="outline"
                  size="sm"
                  touch
                  className="break-keep px-2"
                  onClick={() => on.onChooseName(candidate)}
                >
                  {candidate}
                </Button>
              ))}
            </div>
          )}
          {financeBadge}
        </>
      ) : (
        <ReadView
          row={row}
          name={name}
          badge={financeBadge}
          onStart={on.onStart}
          onRemove={on.onRemove}
        />
      )}
    </div>
  )
}

type ReadProps = Pick<Props, 'row' | 'name' | 'onStart' | 'onRemove'> & { badge: ReactNode }

// 고치지 않을 때: 이름(누르면 고치기)과 재정 표시를 한 줄 가운데에, 오른쪽에 ⋯ 메뉴.
// 재정 표시를 이름 옆에 두어 휴대폰에서 카드 높이가 같다.
function ReadView({ row, name, badge, onStart, onRemove }: ReadProps) {
  // 메뉴 항목을 고르면 그 뒤의 초점(이름 칸, 옆 카드)은 조직도가 옮긴다. Radix가 ⋯ 버튼으로 되돌리지 않게 막는다.
  const chose = useRef(false)
  const choose = (action: () => void) => () => {
    chose.current = true
    action()
  }
  const shown = name.trim() || '빈 부서'
  return (
    <div className="flex items-center gap-1">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
        <Button
          type="button"
          variant="ghost"
          touch
          aria-label={`${shown} 이름 바꾸기`}
          className="-ml-1 h-auto min-w-0 justify-start px-1 py-1 text-left font-semibold whitespace-normal wrap-anywhere text-gray-900"
          onClick={onStart}
        >
          {name}
        </Button>
        {badge}
      </div>
      <Menu>
        <MenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            touch
            data-row={row}
            className="-my-0.5 -mr-1.5"
            aria-label={`${shown} 동작`}
          >
            <Ellipsis />
          </Button>
        </MenuTrigger>
        <MenuContent
          onCloseAutoFocus={event => {
            if (!chose.current) return
            chose.current = false
            event.preventDefault()
          }}
        >
          <MenuItem onSelect={choose(onStart)}>이름 바꾸기</MenuItem>
          {onRemove && <MenuItem onSelect={choose(onRemove)}>빼기</MenuItem>}
        </MenuContent>
      </Menu>
    </div>
  )
}
