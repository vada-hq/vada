import { useRef } from 'react'
import { Ellipsis } from 'lucide-react'
import type { TeamDepartment } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'

type Props = {
  department: TeamDepartment
  saving: boolean
  triggerRef: (element: HTMLElement | null) => void
  onRename: () => void
  onToggleFinance: () => void
  onRemove: () => void
}

// 조직 화면 부서 묶음 머리의 ⋯ 메뉴(회장단, department.manage): 이름 바꾸기, 재정 역할 주고 거두기, 없애기.
export function DepartmentMenu({ department, saving, triggerRef, ...on }: Props) {
  const finance = department.role === 'finance'
  // '이름 바꾸기'를 고르면 초점은 이름 칸으로 간다. Radix가 ⋯ 버튼으로 되돌리지 않게 막는다.
  const renaming = useRef(false)
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon"
          touch
          className="-my-1 -mr-2"
          aria-label={`${department.name} 동작`}
          busy={saving}
        >
          <Ellipsis />
        </Button>
      </MenuTrigger>
      <MenuContent
        onCloseAutoFocus={event => {
          if (!renaming.current) return
          renaming.current = false
          event.preventDefault()
        }}
      >
        <MenuItem
          onSelect={() => {
            renaming.current = true
            on.onRename()
          }}
        >
          이름 바꾸기
        </MenuItem>
        <MenuItem onSelect={on.onToggleFinance}>
          {finance ? '재정 역할 거두기' : '재정 역할 주기'}
        </MenuItem>
        <MenuItem destructive onSelect={on.onRemove}>
          없애기
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
