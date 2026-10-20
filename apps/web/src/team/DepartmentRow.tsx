import { Ellipsis } from 'lucide-react'
import type { TeamDepartment } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'

type Props = {
  department: TeamDepartment
  // 부서를 만들고 고치고 없앨 수 있는가(department.manage). 없으면 ⋯ 메뉴가 없다.
  manage: boolean
  saving: boolean
  triggerRef: (element: HTMLElement | null) => void
  onRename: () => void
  onToggleFinance: () => void
  onRemove: () => void
}

// 부서 한 줄: 이름, 재정 역할 표시, 부서원 수, 그리고 회장단에게만 ⋯ 메뉴.
export function DepartmentRow({ department, manage, saving, triggerRef, ...on }: Props) {
  const finance = department.role === 'finance'
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm wrap-anywhere text-gray-900">
          {department.name}
          {finance && <Badge tone="info">재정</Badge>}
        </p>
        <p className="text-xs text-gray-500">부서원 {department.memberCount}명</p>
      </div>
      {manage && (
        <Menu>
          <MenuTrigger asChild>
            <Button
              ref={triggerRef}
              variant="ghost"
              size="icon"
              aria-label={`${department.name} 동작`}
              disabled={saving}
            >
              <Ellipsis />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={on.onRename}>이름 바꾸기</MenuItem>
            <MenuItem onSelect={on.onToggleFinance}>
              {finance ? '재정 역할 거두기' : '재정 역할 주기'}
            </MenuItem>
            <MenuItem destructive onSelect={on.onRemove}>
              없애기
            </MenuItem>
          </MenuContent>
        </Menu>
      )}
    </li>
  )
}
