import type { LucideIcon } from 'lucide-react'
import { Ellipsis } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'

// 메시지 '…' 메뉴의 한 줄. 메뉴 항목을 더할 때는 useMessageActions가 이 모양을 하나 더 만든다.
export type MessageAction = {
  key: string
  label: string
  icon: LucideIcon
  onSelect: () => void
}

type Props = {
  actions: MessageAction[]
  // 동작이 진행 중이면 메뉴를 막는다.
  busy: boolean
}

// 메시지 하나의 동작 메뉴. 할 수 있는 동작이 없으면 버튼도 없다.
export default function MessageMenu({ actions, busy }: Props) {
  if (actions.length === 0) return null
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="메시지 동작" disabled={busy}>
          <Ellipsis />
        </Button>
      </MenuTrigger>
      <MenuContent>
        {actions.map(({ key, label, icon: Icon, onSelect }) => (
          <MenuItem key={key} disabled={busy} onSelect={onSelect}>
            <Icon aria-hidden />
            {label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}
