import { Plus } from 'lucide-react'
import type { TeamMember } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'

type Props = {
  departmentName: string
  headTitle: string
  // 부서 배정 창을 열 수 있는 사람(서버가 준 줄 동작). 없으면 버튼도 없다.
  candidates: TeamMember[]
  saving: boolean
  triggerRef: (element: HTMLElement | null) => void
  onPick: (member: TeamMember) => void
}

// 부장 없는 부서의 [부장 지정](와이어프레임 ORG-03A 점선 칸). 사람을 고르면 그 사람의 부서 배정 창이 열린다.
// 부서 직급은 그 창에서 정하므로 사람 카드 ⋯의 '부서 배정'과 같은 길이다.
export function HeadPicker({ departmentName, headTitle, candidates, triggerRef, ...props }: Props) {
  if (candidates.length === 0) return null
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          size="sm"
          aria-label={`${departmentName} ${headTitle} 지정`}
          busy={props.saving}
          className="border-dashed border-primary-border text-primary-strong shadow-none"
        >
          <Plus />
          {headTitle} 지정
        </Button>
      </MenuTrigger>
      <MenuContent align="start">
        {candidates.map(member => (
          <MenuItem key={member.id} onSelect={() => props.onPick(member)}>
            {member.name}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}
