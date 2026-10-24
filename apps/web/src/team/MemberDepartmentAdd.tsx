import { useState } from 'react'
import type { CouncilTitles, DepartmentRank, TeamDepartment } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { RankOptions, rankOf } from './rank-select'

// 더할 부서와 직급을 고른 값. 방금 넣은 부서는 고르는 칸에서 빠지므로 그때는 남은 첫 부서를 고른다.
export function useAddDepartment(others: TeamDepartment[]) {
  const [adding, setAdding] = useState(others[0]?.id ?? '')
  const [rank, setRank] = useState('')
  const selected = others.some(department => department.id === adding)
    ? adding
    : (others[0]?.id ?? '')
  return { selected, rank, setAdding, setRank }
}
type AddDepartment = ReturnType<typeof useAddDepartment>

type Props = {
  others: TeamDepartment[]
  titles: CouncilTitles
  saving: boolean
  // 부서 직급을 정할 수 있는가. 아니면 직급 없이 넣는다(P19).
  canRank: boolean
  add: AddDepartment
  onAssign: (departmentId: string, rank: DepartmentRank | null) => void
}

// 부서 배정 대화상자의 "부서 더하기": 아직 들어 있지 않은 부서와 직급을 골라 넣는다.
export function MemberDepartmentAdd({ others, titles, saving, canRank, add, onAssign }: Props) {
  return (
    <section aria-label="부서 더하기" className="flex flex-col gap-2 border-t pt-4">
      <div className="grid grid-cols-2 gap-2">
        <Label className="flex flex-col gap-1.5">
          부서
          <NativeSelect value={add.selected} onChange={event => add.setAdding(event.target.value)}>
            {others.map(department => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </NativeSelect>
        </Label>
        <Label className="flex flex-col gap-1.5">
          부서 직급
          <NativeSelect
            value={canRank ? add.rank : ''}
            disabled={!canRank}
            onChange={event => add.setRank(event.target.value)}
          >
            <RankOptions titles={titles} />
          </NativeSelect>
        </Label>
      </div>
      <Button
        variant="outline"
        className="self-start"
        busy={saving}
        onClick={() => onAssign(add.selected, canRank ? rankOf(add.rank) : null)}
      >
        부서에 넣기
      </Button>
    </section>
  )
}
