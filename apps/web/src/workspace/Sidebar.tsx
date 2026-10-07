import type { ReactNode } from 'react'
import type { MembershipSummary } from '@vada/contracts'
import InviteShare from '../access/InviteShare'

export type AccountProps = { user: { name: string; email: string }; logoutBusy: boolean; onLogout: () => void }
type Props = AccountProps & { membership: MembershipSummary; memberships: MembershipSummary[]; onMembershipChange: (id: string) => void; children: ReactNode }
export default function Sidebar({ membership, memberships, onMembershipChange, user, logoutBusy, onLogout, children }: Props) {
  return <aside className="workspace-sidebar" aria-label="학생회 작업 공간">
    <header className="sidebar-brand"><strong>VADA</strong><span className="badge">M1</span></header>
    <section className="sidebar-membership" aria-label="내 소속">
      {memberships.length > 1 ? <label>학생회 선택<select value={membership.id} onChange={event => onMembershipChange(event.target.value)}>
        {memberships.map(item => <option key={item.id} value={item.id}>{item.organization.name} · {item.department?.name ?? '미배정'}</option>)}
      </select></label> : <h2>{membership.organization.name}</h2>}
      <p>{membership.department?.name ?? '미배정'}</p>
      {membership.department?.handlesFinance && <span className="badge">재정 담당</span>}
      <InviteShare code={membership.organization.inviteCode} />
    </section>
    <div className="sidebar-events">{children}</div>
    <footer className="sidebar-account"><strong>{user.name}</strong><p className="hint email">{user.email}</p>
      <button className="button-quiet" disabled={logoutBusy} onClick={onLogout}>{logoutBusy ? '로그아웃 중…' : '로그아웃'}</button>
    </footer>
  </aside>
}
