import { useState } from 'react'
import { menuPath } from '@vada/contracts'
import { navigate } from '@/lib/app-location'
import CouncilWorkspace from './CouncilWorkspace'
import type { Opener, WorkspaceProps } from './pages'

// 작업 공간 틀. 어느 학생회의 어느 메뉴인지는 주소가 정하고(address.ts), 학생회를 고르면 그 학생회 홈 주소로 한 칸 쌓는다.
export default function Workspace({ councils, target, ...props }: WorkspaceProps) {
  const [picked, setPicked] = useState<{ councilId: string; from: Opener } | null>(null)
  const council = councils.find(item => item.id === target.councilId)
  if (!council) return null
  // 고른 학생회가 열릴 때만 포커스를 옮긴다. 학생회를 잃어 다른 학생회로 넘어갈 때는 옮기지 않는다.
  return (
    <CouncilWorkspace
      key={council.id}
      {...props}
      councils={councils}
      council={council}
      target={target}
      returnFocusTo={picked?.councilId === council.id ? picked.from : null}
      onSelect={(next, from) => {
        setPicked({ councilId: next, from })
        navigate(menuPath('home', next))
      }}
    />
  )
}
