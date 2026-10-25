import { useRef, type ComponentProps } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DepartmentCreateForm } from './DepartmentCreateForm'

type Props = Omit<ComponentProps<typeof DepartmentCreateForm>, 'onClose'> & {
  open: boolean
  onOpen: () => void
  onClose: () => void
}

// 부서 목록 끝의 점선 칸 [부서 추가](와이어프레임 ORG-03B DeptCard addDept). 누르면 그 자리에 이름 칸이 펼쳐진다.
export function DepartmentAdd({ open, onOpen, onClose, ...form }: Props) {
  // 칸을 접으면 초점을 다시 그려진 [부서 추가]로 돌려준다.
  const back = useRef(false)
  if (!open)
    return (
      <Button
        ref={element => {
          if (!element || !back.current) return
          back.current = false
          element.focus()
        }}
        variant="outline"
        className="min-h-24 w-full border-2 border-dashed border-gray-300 text-gray-500 shadow-none hover:border-gray-400"
        onClick={onOpen}
      >
        <Plus />
        부서 추가
      </Button>
    )
  return (
    <div className={cn(cardClass, 'border-2 border-dashed border-gray-300 p-4 shadow-none')}>
      <DepartmentCreateForm
        {...form}
        onClose={() => {
          back.current = true
          onClose()
        }}
      />
    </div>
  )
}
