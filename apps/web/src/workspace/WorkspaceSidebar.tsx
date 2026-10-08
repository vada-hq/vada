import { useState, type ReactNode } from 'react'
import { LogOut, UserPlus, Users } from 'lucide-react'
import type { MembershipSummary } from '@vada/contracts'
import InviteShare from '../access/InviteShare'
import { Avatar } from '@/components/Avatar'
import { BrandMark } from '@/components/BrandMark'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { NavItem } from '@/components/ui/nav-item'

export type AccountProps = { user: { name: string; email: string }; logoutBusy: boolean; onLogout: () => void }
type Props = AccountProps & { membership: MembershipSummary; memberships: MembershipSummary[]; onMembershipChange: (id: string) => void
  membersActive: boolean; unassignedCount: number | null; onMembers: () => void; children: ReactNode }

// 와이어프레임 사이드바(210px): 위 로고와 학생회 이름, 가운데 행사 메뉴, 아래 사용자.
// 데스크톱 aside와 휴대폰 옆 메뉴가 같이 쓴다. 위 블록의 오른쪽 여백은 옆 메뉴 닫기 버튼 자리다.
export default function WorkspaceSidebar({ membership, memberships, onMembershipChange, membersActive, unassignedCount, onMembers, user, logoutBusy, onLogout, children }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false)
  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 py-4 pr-10 pl-5">
      <BrandMark />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">VADA</p>
        <h2 className="text-xs font-normal wrap-anywhere text-gray-400">{membership.organization.name}</h2>
      </div>
    </div>
    <section className="flex shrink-0 flex-col gap-2 border-b border-gray-100 px-4 py-3" aria-label="내 소속">
      {memberships.length > 1 && <Label className="flex flex-col gap-1.5">학생회 선택
        <NativeSelect value={membership.id} onChange={event => onMembershipChange(event.target.value)}>
          {memberships.map(item => <option key={item.id} value={item.id}>{item.organization.name} · {item.department?.name ?? '미배정'}</option>)}
        </NativeSelect></Label>}
      <Button variant="outline" size="sm" className="w-full" onClick={() => setInviteOpen(true)}><UserPlus />구성원 초대</Button>
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>구성원 초대</DialogTitle>
            <DialogDescription>링크나 코드를 공유하면 학생회에 참여할 수 있어요. 참여한 사람은 미배정으로 등록돼요.</DialogDescription></DialogHeader>
          <InviteShare code={membership.organization.inviteCode} />
        </DialogContent>
      </Dialog>
    </section>
    <nav aria-label="학생회 메뉴" className="shrink-0 border-b border-gray-100 px-2 py-2">
      <NavItem active={membersActive} className="flex items-center gap-2" onClick={onMembers}>
        <Users aria-hidden className="size-4" />구성원
        {unassignedCount ? <Badge tone="warning" className="ml-auto">미배정 {unassignedCount}</Badge> : null}
      </NavItem>
    </nav>
    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">{children}</div>
    <footer className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700">{user.name}</p>
        <p className="flex flex-wrap items-center gap-1 text-xs text-gray-400">{membership.department?.name ?? '미배정'}{membership.title && ` · ${membership.title}`}
          {membership.permissions.approvePurchases && <Badge tone="info">구매 승인</Badge>}</p>
      </div>
      <Button variant="ghost" size="icon" aria-label="로그아웃" disabled={logoutBusy} onClick={onLogout}><LogOut /></Button>
    </footer>
  </div>
}
