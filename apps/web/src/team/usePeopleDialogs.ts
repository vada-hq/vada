import { useEffect, useRef, useState } from 'react'
import type { TeamResponse } from '@vada/contracts'
import { useLatest } from '@/lib/use-latest'
import { changedByOwnRead, type Reading } from '@/lib/use-lost'
import {
  closedReason,
  findConfirming,
  findEditing,
  findViewing,
  type Can,
  type Confirm,
} from './people-access'

// 사람 화면의 창 셋(사람 상세, 부서 배정, 확인)의 대상. 다시 읽은 목록과 권한으로 매번 대상을 찾으므로,
// 대상이 사라졌거나 권한을 잃으면 창은 닫히고 onClosed로 까닭을 알린다.
// 권한을 가져온 읽기(reading)가 내 변경 뒤의 다시 읽기여서 닫혔으면 알리지 않는다.
export function usePeopleDialogs(
  data: TeamResponse | null,
  me: string,
  { can, reading }: { can: Can; reading: Reading },
  onClosed: (reason: string) => void,
) {
  const [viewing, setViewing] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const viewingMember = findViewing(data?.members, viewing)
  const editingMember = findEditing(data?.members, editing, can)
  const confirming = findConfirming(data?.members, confirm, me, can)
  const viewingGone = isGone(data, viewing, viewingMember)
  const editingGone = isGone(data, editing, editingMember)
  const confirmGone = isGone(data, confirm, confirming)
  // 닫힌 창의 대상을 지운다. 나중에 같은 운영진이 다시 목록에 나타나도 창이 저절로 열리지 않게 한다.
  const viewingReason = closedReason(data?.members, viewing)
  const editingReason = closedReason(data?.members, editing)
  const confirmReason = closedReason(data?.members, confirm?.memberId ?? null)
  useWhenClosed(viewingGone, { reason: viewingReason, reading }, onClosed, () => setViewing(null))
  useWhenClosed(editingGone, { reason: editingReason, reading }, onClosed, () => setEditing(null))
  useWhenClosed(confirmGone, { reason: confirmReason, reading }, onClosed, () => setConfirm(null))
  return { viewingMember, editingMember, confirming, setViewing, setEditing, setConfirm }
}

// 목록을 읽은 뒤 열려 있던(대상을 기억하던) 창의 대상을 못 찾으면 닫힌 것이다.
const isGone = (data: TeamResponse | null, key: unknown, found: unknown) =>
  data !== null && key !== null && !found

// 대상을 잃어 창이 닫혔을 때 한 번 대상을 지우고, 내 변경에서 온 값으로 닫힌 게 아니면 까닭을 알린다.
// reason은 닫힌 까닭, reading은 그때 권한을 가져온 읽기다.
function useWhenClosed(
  gone: boolean,
  { reason, reading }: { reason: string; reading: Reading },
  onClosed: (reason: string) => void,
  clear: () => void,
) {
  const closed = useLatest(onClosed)
  const clearing = useLatest(clear)
  const seen = useRef(reading)
  useEffect(() => {
    const before = seen.current
    seen.current = reading
    if (!gone) return
    clearing.current()
    if (!changedByOwnRead(before, reading)) closed.current(reason)
  }, [gone, reason, reading, closed, clearing])
}
