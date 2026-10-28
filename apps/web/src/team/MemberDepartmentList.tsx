import { X } from 'lucide-react'
import type { CouncilTitles, DepartmentRank, TeamDepartment, TeamMember } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { RankOptions, rankOf, rankValue } from './rank-select'

type Props = {
  member: TeamMember
  departments: TeamDepartment[]
  titles: CouncilTitles
  saving: boolean
  canRank: boolean
  onAssign: (departmentId: string, rank: DepartmentRank | null) => void
  onRemove: (departmentId: string) => void
}

// 부서 배정 대화상자의 "지금 부서": 부서마다 부서 직급을 바꾸거나 뺀다.
// 빼기 버튼은 서버가 소속마다 준 동작(placement.remove)으로 보인다. 직급이 붙은 소속의 규칙은 서버가 정한다(DEC-38).
export function MemberDepartmentList({
  member,
  departments,
  titles,
  saving,
  canRank,
  onAssign,
  onRemove,
}: Props) {
  return (
    <section aria-label="지금 부서" className="flex flex-col gap-2">
      {member.departments.length === 0 && <p className="text-sm text-gray-500">부서 없음</p>}
      {member.departments.map(item => {
        const name = departments.find(department => department.id === item.id)?.name ?? ''
        return (
          <div key={item.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-sm wrap-anywhere text-gray-800">{name}</span>
            <NativeSelect
              aria-label={`${name} 부서 직급`}
              className="w-32"
              value={rankValue(item.rank)}
              disabled={saving || !canRank}
              onChange={event => onAssign(item.id, rankOf(event.target.value))}
            >
              <RankOptions titles={titles} />
            </NativeSelect>
            {item.actions.includes('placement.remove') && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${name}에서 빼기`}
                busy={saving}
                onClick={() => onRemove(item.id)}
              >
                <X />
              </Button>
            )}
          </div>
        )
      })}
    </section>
  )
}
