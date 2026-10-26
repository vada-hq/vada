import { ChevronDown } from 'lucide-react'
import type { TeamMember } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'

type Props = {
  label: string
  // 그 묶음 이름까지 붙인 버튼 이름(같은 버튼이 묶음마다 있다).
  accessibleName: string
  people: TeamMember[]
  saving: boolean
  onPick: (member: TeamMember) => void
}

// 묶음 머리의 '{부장} 지정'·'{부회장} 지정'(DEC-91): 사람을 고르면 바로 저장하고 되돌리기를 준다. 기본으로 골라 둔 사람은 없다.
export function PersonPicker({ label, accessibleName, people, saving, onPick }: Props) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="outline" size="sm" touch busy={saving} aria-label={accessibleName}>
          {label}
          <ChevronDown aria-hidden />
        </Button>
      </MenuTrigger>
      <MenuContent>
        {people.map(member => (
          <MenuItem key={member.id} onSelect={() => onPick(member)}>
            {member.name}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}
