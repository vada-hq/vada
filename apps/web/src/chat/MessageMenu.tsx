import { useRef } from 'react'
import type { ChatMessage } from '@vada/contracts'
import type { LucideIcon } from 'lucide-react'
import { Ellipsis, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { useMessageDeletion } from './useMessageDeletion'

// 메시지 '…' 메뉴의 한 줄. 메뉴 항목을 더할 때는 useMessageActions가 이 모양을 하나 더 만든다.
export type MessageAction = {
  key: string
  label: string
  icon: LucideIcon
  onSelect: () => void
}

type Props = {
  actions: MessageAction[]
  councilId: string
  message: ChatMessage
  mine: boolean
  onDeleted: () => void
  // 동작이 진행 중이면 메뉴를 막는다. 지금 메뉴의 동작은 모두 대화상자를 열 뿐이라 기본은 false다.
  busy?: boolean
}

// 메시지 하나의 동작 메뉴. 할 수 있는 동작이 없으면 버튼도 없다.
export default function MessageMenu({
  actions,
  councilId,
  message,
  mine,
  onDeleted,
  busy = false,
}: Props) {
  const {
    open,
    busy: deleting,
    error,
    ask,
    close,
    remove,
  } = useMessageDeletion(councilId, message.id, onDeleted)
  const trigger = useRef<HTMLButtonElement>(null)
  const canDelete = mine && message.body !== null
  if (actions.length === 0 && !canDelete) return null
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button
            ref={trigger}
            variant="ghost"
            size="icon"
            touch
            aria-label="메시지 동작"
            busy={busy || deleting}
          >
            <Ellipsis />
          </Button>
        </MenuTrigger>
        <MenuContent>
          {actions.map(({ key, label, icon: Icon, onSelect }) => (
            <MenuItem
              key={key}
              className="break-keep max-sm:min-h-11"
              disabled={busy || deleting}
              onSelect={onSelect}
            >
              <Icon aria-hidden />
              {label}
            </MenuItem>
          ))}
          {canDelete && (
            <MenuItem
              className="break-keep max-sm:min-h-11"
              disabled={busy || deleting}
              onSelect={ask}
            >
              <Trash2 aria-hidden />
              메시지 삭제
            </MenuItem>
          )}
        </MenuContent>
      </Menu>
      {open && (
        <ConfirmDialog
          title="메시지를 삭제할까요?"
          confirmLabel="삭제"
          destructive
          touch
          busy={deleting}
          error={error}
          onConfirm={() => void remove()}
          onClose={close}
          onCloseAutoFocus={event => {
            event.preventDefault()
            trigger.current?.focus()
          }}
        />
      )}
    </>
  )
}
