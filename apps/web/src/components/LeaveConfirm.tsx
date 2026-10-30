import { useEffect } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { confirmLeave, stayHere, useLeaveRequest } from '@/lib/leave-guard'
import { LEAVE_CONFIRM, LEAVE_TITLE } from '@/lib/messages'

// 저장하지 않은 입력이 있는데 다른 곳으로 가려 할 때 묻는 창(lib/leave-guard.ts). 작업 공간에 하나만 둔다.
// '닫기'는 창을 닫고 계속 쓰는 것이다.
export default function LeaveConfirm({ touch = false }: { touch?: boolean }) {
  const request = useLeaveRequest()
  // 작업 공간이 사라지면 떠 있던 요청도 버린다(다음 작업 공간이 옛 이동을 묻지 않게).
  useEffect(() => stayHere, [])
  if (!request) return null
  return (
    <ConfirmDialog
      destructive
      touch={touch}
      title={LEAVE_TITLE}
      confirmLabel={LEAVE_CONFIRM}
      onConfirm={confirmLeave}
      onClose={stayHere}
    />
  )
}
