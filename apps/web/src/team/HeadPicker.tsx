import { Plus } from 'lucide-react'
import type { TeamMember } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'

type Props = {
  headTitle: string
  // 부서 배정 창을 열 수 있는 사람(서버가 준 줄 동작). 없으면 버튼도 없다.
  candidates: TeamMember[]
  saving: boolean
  triggerRef: (element: HTMLElement | null) => void
  onPick: (member: TeamMember) => void
}

// 부장 없는 부서의 [부장 지정](와이어프레임 ORG-03A 점선 칸). 사람을 고르면 그 사람의 부서 배정 창이 열린다.
// 부서 직급은 그 창에서 정하므로 사람 카드 ⋯의 '부서 배정'과 같은 길이다. 부서 카드(region) 안이라 이름에 부서를 붙이지 않는다
// (동작 버튼 이름 목록 structure/role-read-matrix.test.tsx의 '부장 지정').
export function HeadPicker({ headTitle, candidates, triggerRef, ...props }: Props) {
  if (candidates.length === 0) return null
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          size="sm"
          busy={props.saving}
          className="border-dashed border-primary-border text-primary-strong shadow-none"
        >
          <Plus />
          {headTitle} 지정
        </Button>
      </MenuTrigger>
      {/* 후보가 수십 명이어도 화면 안에서 스크롤한다. */}
      <MenuContent
        align="start"
        className="max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto"
      >
        {candidates.map(member => (
          <MenuItem
            key={member.id}
            className="max-sm:min-h-11"
            onSelect={() => props.onPick(member)}
          >
            {member.name}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}
