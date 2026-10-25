import { useId, useRef } from 'react'
import { Ellipsis } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
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
  onCommit: (refocus: boolean) => void
  onCancel: () => void
  // 재정 부서는 뺄 수 없어 없다.
  onRemove?: (() => void) | undefined
}

// 조직도의 부서 카드(와이어프레임 ORG-02): 이름과 오른쪽 위 ⋯ 메뉴(이름 바꾸기·빼기), 재정 역할 부서는 '재정' 표시.
// 이름 바꾸기는 카드 안 제자리 편집이다. Enter 저장, Esc 취소(Atlassian inline edit).
export default function DepartmentCard({ row, label, name, editing, error, ...on }: Props) {
  const errorId = useId()
  // 메뉴 항목을 고르면 그 뒤의 초점(이름 칸, 옆 카드)은 조직도가 옮긴다. Radix가 ⋯ 버튼으로 되돌리지 않게 막는다.
  const chose = useRef(false)
  const choose = (action: () => void) => () => {
    chose.current = true
    action()
  }
  const showInput = editing || error !== undefined
  return (
    <div className={cn(cardClass, 'flex min-w-0 flex-1 flex-col gap-1.5 p-3')}>
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
            onBlur={() => on.onCommit(false)}
            onKeyDown={event => {
              // 한글 조합을 끝내는 Enter는 저장이 아니다.
              if (event.nativeEvent.isComposing) return
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
        </>
      ) : (
        <div className="flex items-start gap-1">
          <p className="min-w-0 flex-1 py-1.5 text-sm font-semibold wrap-anywhere text-gray-900">
            {name}
          </p>
          <Menu>
            <MenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                touch
                data-row={row}
                className="-my-0.5 -mr-1.5"
                aria-label={`${name.trim() || '빈 부서'} 동작`}
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
              <MenuItem onSelect={choose(on.onStart)}>이름 바꾸기</MenuItem>
              {on.onRemove && <MenuItem onSelect={choose(on.onRemove)}>빼기</MenuItem>}
            </MenuContent>
          </Menu>
        </div>
      )}
      {row === 'finance' && (
        <Badge tone="info" className="self-start">
          재정
        </Badge>
      )}
    </div>
  )
}
