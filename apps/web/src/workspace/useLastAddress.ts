import { useEffect } from 'react'
import { menuPath, parseAppPath, type MyCouncil } from '@vada/contracts'
import type { Here } from '@/lib/app-location'
import { lastAddress, rememberAddress } from '@/lib/last-address'
import { targetOf } from './address'

// '/'로 열렸을 때 갈 곳: 이 기기가 마지막에 본 주소가 아직 내 학생회의 것이면 그곳, 없거나 그 학생회를 잃었으면 첫 학생회 홈.
export function startPathOf(userId: string, councils: MyCouncil[]) {
  const first = councils[0]
  if (!first) return null
  const saved = lastAddress(userId)
  const councilId = saved === null ? undefined : parseAppPath(saved)?.councilId
  return saved !== null && councils.some(council => council.id === councilId)
    ? saved
    : menuPath('home', first.id)
}

// 학생회 안에서 보는 곳을 기억한다. '찾을 수 없음'(남의 학생회, 모르는 주소)은 기억하지 않는다.
export function useRememberAddress(userId: string, here: Here, councils: MyCouncil[]) {
  const ready = targetOf(here, councils).kind === 'ready'
  useEffect(() => {
    if (ready && here.location) rememberAddress(userId, here.path)
  }, [userId, ready, here.location, here.path])
}
