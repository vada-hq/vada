import { useEffect, useState } from 'react'
import type { TeamResponse } from '@vada/contracts'
import { findConfirming, findEditing, type Can, type Confirm } from './people-access'

// 사람 화면의 대화상자 둘(부서 배정, 확인)의 대상. 다시 읽은 목록과 권한으로 매번 대상을 찾으므로,
// 대상이 사라졌거나 권한을 잃으면 대화상자는 닫힌다.
export function usePeopleDialogs(data: TeamResponse | null, me: string, can: Can) {
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const editingMember = findEditing(data?.members, editing, can)
  const confirming = findConfirming(data?.members, confirm, me, can)
  const editingGone = data !== null && editing !== null && !editingMember
  const confirmGone = data !== null && confirm !== null && !confirming
  // 닫힌 대화상자의 대상을 지운다. 나중에 같은 운영진이 다시 목록에 나타나도 대화상자가 저절로 열리지 않게 한다.
  useEffect(() => {
    if (editingGone) setEditing(null)
  }, [editingGone])
  useEffect(() => {
    if (confirmGone) setConfirm(null)
  }, [confirmGone])
  return { editingMember, confirming, setEditing, setConfirm }
}
