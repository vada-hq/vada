import { useState } from 'react'
import type { TeamDepartment } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { DepartmentMenu } from '@/team/DepartmentMenu'
import { RemoveDepartmentDialog } from '@/team/DepartmentDialogs'
import { Section } from './GallerySection'

const noop = () => {}
const used: TeamDepartment = { id: 'd2', name: '홍보부', role: null, memberCount: 3, used: true }
const unused: TeamDepartment = { id: 'd3', name: '체육부', role: null, memberCount: 0, used: false }

// 쓴 부서 그만 쓰기와 쓰이지 않은 부서 없애기(DEC-91, 기능 023 조각 7): 부서 머리 ⋯의 항목과 확인 창.
export function DepartmentRetireSection() {
  const [open, setOpen] = useState<TeamDepartment | null>(null)
  const [error, setError] = useState('')
  return (
    <Section title="부서 그만 쓰기·없애기">
      <div className="flex flex-wrap items-center gap-3">
        {[used, unused].map(department => (
          <span key={department.id} className="flex items-center gap-1 text-sm">
            {department.name}
            <DepartmentMenu
              department={department}
              saving={false}
              triggerRef={noop}
              onRename={noop}
              onToggleFinance={noop}
              onRemove={() => setOpen(department)}
            />
          </span>
        ))}
        <Button variant="outline" onClick={() => setOpen(used)}>
          그만 쓰기 확인 창 열기
        </Button>
        <Button variant="outline" onClick={() => setOpen(unused)}>
          없애기 확인 창 열기
        </Button>
      </div>
      <RemoveDepartmentDialog
        department={open}
        busy={false}
        error={error}
        onClose={() => {
          setOpen(null)
          setError('')
        }}
        onConfirm={() =>
          setError('재정 역할이 있는 부서는 그만 쓸 수 없어요. 먼저 재정 역할을 거둬 주세요.')
        }
      />
    </Section>
  )
}
