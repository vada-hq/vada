import { useState } from 'react'
import { X } from 'lucide-react'
import type { CouncilTitles, DepartmentRank, TeamDepartment, TeamMember } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

type Props = {
  member: TeamMember
  departments: TeamDepartment[]
  titles: CouncilTitles
  saving: boolean
  // 부서 직급(부장·부부장)을 바꿀 수 있는가(rank.manage). 부서에 넣고 빼는 일은 member.manage만으로 된다(P19).
  canRank: boolean
  error: string
  onAssign: (departmentId: string, rank: DepartmentRank | null) => void
  onRemove: (departmentId: string) => void
  onClose: () => void
  onCloseAutoFocus?: (event: Event) => void
}

const rankValue = (rank: DepartmentRank | null) => rank ?? ''
const rankOf = (value: string): DepartmentRank | null => value === 'head' || value === 'vice_head' ? value : null

// 부서 배정(회장단): 지금 부서마다 부서 직급을 바꾸거나 빼고, 다른 부서에 더한다. 한 사람이 여러 부서에 있을 수 있다(DEC-16).
export default function MemberDepartmentsDialog({ member, departments, titles, saving, canRank, error, onAssign, onRemove, onClose, onCloseAutoFocus }: Props) {
  const others = departments.filter(department => !member.departments.some(item => item.id === department.id))
  const [adding, setAdding] = useState(others[0]?.id ?? '')
  const [addingRank, setAddingRank] = useState('')
  // 방금 넣은 부서는 고르는 칸에서 빠진다. 그때는 남은 첫 부서를 고른다.
  const selected = others.some(department => department.id === adding) ? adding : others[0]?.id ?? ''
  const rankOptions = <><option value="">직급 없음</option><option value="head">{titles.head}</option><option value="vice_head">{titles.viceHead}</option></>
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}>
    <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader><DialogTitle className="wrap-anywhere">{member.name}의 부서</DialogTitle>
        <DialogDescription>부서와 부서 직급을 정해요. 바꾸면 바로 저장돼요.</DialogDescription></DialogHeader>
      <section aria-label="지금 부서" className="flex flex-col gap-2">
        {member.departments.length === 0 && <p className="text-sm text-gray-500">아직 부서가 없어요.</p>}
        {member.departments.map(item => {
          const name = departments.find(department => department.id === item.id)?.name ?? ''
          return <div key={item.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-sm wrap-anywhere text-gray-800">{name}</span>
            <NativeSelect aria-label={`${name} 부서 직급`} className="w-32" value={rankValue(item.rank)} disabled={saving || !canRank}
              onChange={event => onAssign(item.id, rankOf(event.target.value))}>{rankOptions}</NativeSelect>
            <Button variant="ghost" size="icon" aria-label={`${name}에서 빼기`} disabled={saving} onClick={() => onRemove(item.id)}><X /></Button>
          </div>
        })}
      </section>
      {others.length > 0
        ? <section aria-label="부서 더하기" className="flex flex-col gap-2 border-t pt-4">
          <div className="grid grid-cols-2 gap-2">
            <Label className="flex flex-col gap-1.5">부서
              <NativeSelect value={selected} onChange={event => setAdding(event.target.value)}>
                {others.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
              </NativeSelect>
            </Label>
            <Label className="flex flex-col gap-1.5">부서 직급
              <NativeSelect value={canRank ? addingRank : ''} disabled={!canRank} onChange={event => setAddingRank(event.target.value)}>{rankOptions}</NativeSelect>
            </Label>
          </div>
          <Button variant="outline" className="self-start" disabled={saving} onClick={() => onAssign(selected, canRank ? rankOf(addingRank) : null)}>부서에 넣기</Button>
        </section>
        : departments.length === 0 && <p className="text-sm text-gray-500">부서가 없어요. 운영진 &gt; 부서에서 먼저 만들어 주세요.</p>}
      {error && <StateMessage kind="error">{error}</StateMessage>}
    </DialogContent>
  </Dialog>
}
