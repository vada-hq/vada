import { useState } from 'react'
import { Ellipsis } from 'lucide-react'
import type { Action, CouncilView, DepartmentRank, TeamMember } from '@vada/contracts'
import { Avatar } from '@/components/Avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import InviteCard from './InviteCard'
import MemberDepartmentsDialog from './MemberDepartmentsDialog'
import { councilRankLabel, joinedDay, placementsText } from './team-view'
import type { Team } from './useTeam'

const errors: Record<string, string> = {
  PRESIDENT_CANNOT_LEAVE: '회장은 내보낼 수 없어요. 먼저 회장을 넘겨 주세요.',
  CANNOT_REMOVE_SELF: '나를 내보낼 수는 없어요.',
  PRESIDENT_REQUIRED: '회장의 직급은 회장 넘기기로만 바꿀 수 있어요.',
  ALREADY_PRESIDENT: '이미 회장이에요.',
  FORBIDDEN: '권한이 바뀌었어요. 화면을 새로 불러왔어요.',
  NOT_FOUND: '이미 바뀌었어요. 목록을 새로 불러왔어요.',
}
const failure = '저장하지 못했어요. 다시 시도해 주세요.'
type Confirm = { kind: 'remove' | 'transfer'; member: TeamMember }

type Props = { view: CouncilView; team: Team; onCouncilChanged: () => void }

// 운영진 > 사람: 이름, 직급(학생회가 정한 표시 이름), 부서와 부서 직급, 들어온 날. 들어온 순서대로다(DEC-47).
// 회장단은 초대 링크와 줄마다 ⋯ 메뉴(부서 배정, 직급, 내보내기)를 보고, 회장은 회장 넘기기를 더 본다.
// 동작 버튼은 서버가 준 내 권한 목록으로만 보이거나 숨긴다(DEC-38).
export default function People({ view, team, onCouncilChanged }: Props) {
  const { data, loadFailed, saving, change, reload } = team
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  if (!data) return loadFailed
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">운영진을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={reload}>다시 시도</Button></Card>
    : <StateMessage kind="loading">운영진 불러오는 중…</StateMessage>
  const current = data
  const titles = view.council.titles
  const me = view.me.memberId
  const can = (action: Action) => view.permissions.includes(action)
  const editingMember = current.members.find(member => member.id === editing) ?? null

  // 성공하면 true다. 실패하면 문구를 보여 준다. 내 직급이 바뀌면 학생회를 다시 읽어 권한을 새로 받는다.
  async function run(path: string, body: unknown, changesMe = false) {
    setMessage('')
    const code = await change(path, body)
    if (code) {
      setMessage(errors[code] ?? failure)
      return false
    }
    if (changesMe) onCouncilChanged()
    return true
  }
  const memberPath = (member: TeamMember) => `/members/${encodeURIComponent(member.id)}`
  function assign(member: TeamMember, departmentId: string, rank: DepartmentRank | null) {
    void run(`${memberPath(member)}/departments`, { departmentId, rank }, member.id === me)
  }
  function removeFrom(member: TeamMember, departmentId: string) {
    void run(`${memberPath(member)}/departments/${encodeURIComponent(departmentId)}/remove`, {}, member.id === me)
  }
  async function confirmed() {
    if (!confirm) return
    const done = confirm.kind === 'remove'
      ? await run(`${memberPath(confirm.member)}/remove`, {})
      : await run('/president/transfer', { memberId: confirm.member.id }, true)
    if (done) setConfirm(null)
  }

  return <div className="mx-auto flex max-w-3xl flex-col gap-4">
    {can('invite.manage') && <InviteCard councilId={view.council.id} />}
    <h2 className="text-base font-semibold text-gray-900">운영진 {current.members.length}명</h2>
    {message && !editing && !confirm && <StateMessage kind="error">{message}</StateMessage>}
    <Card className="overflow-hidden">
      <ul aria-label="운영진" className="divide-y">
        {current.members.map(member => {
          const rank = councilRankLabel(member.councilRank, titles)
          const placements = placementsText(member, current.departments, titles)
          const president = member.councilRank === 'president'
          return <li key={member.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm wrap-anywhere text-gray-900">{member.name}
                {rank && <Badge tone="info">{rank}</Badge>}</p>
              <p className="text-xs wrap-anywhere text-gray-500">{placements || '부서 없음'} · {joinedDay(member.joinedAt)} 들어옴</p>
            </div>
            {can('member.manage') && <Menu>
              <MenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${member.name} 동작`} disabled={saving}><Ellipsis /></Button></MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => { setMessage(''); setEditing(member.id) }}>부서 배정</MenuItem>
                {can('rank.manage') && !president && <MenuItem onSelect={() => {
                  void run(`${memberPath(member)}/rank`, { rank: member.councilRank === 'vice_president' ? null : 'vice_president' }, member.id === me)
                }}>{member.councilRank === 'vice_president' ? `${titles.vicePresident} 직급 거두기` : `${titles.vicePresident} 직급 주기`}</MenuItem>}
                {can('president.transfer') && member.id !== me && <MenuItem onSelect={() => { setMessage(''); setConfirm({ kind: 'transfer', member }) }}>
                  {titles.president} 넘기기</MenuItem>}
                {!president && member.id !== me && <MenuItem destructive onSelect={() => { setMessage(''); setConfirm({ kind: 'remove', member }) }}>
                  내보내기</MenuItem>}
              </MenuContent>
            </Menu>}
          </li>
        })}
      </ul>
    </Card>
    {editingMember && <MemberDepartmentsDialog key={editingMember.id} member={editingMember} departments={current.departments} titles={titles}
      saving={saving} error={message} onClose={() => { setEditing(null); setMessage('') }}
      onAssign={(departmentId, rank) => assign(editingMember, departmentId, rank)} onRemove={departmentId => removeFrom(editingMember, departmentId)} />}
    <ConfirmDialog open={confirm?.kind === 'remove'} destructive busy={saving} error={confirm ? message : ''}
      title={`${confirm?.member.name ?? ''}님을 내보낼까요?`}
      description="학생회 소속과 부서 소속이 함께 끝나요. 초대 링크로 다시 들어올 수 있지만, 부서와 직급은 다시 정해야 해요."
      confirmLabel="내보내기" onCancel={() => { setConfirm(null); setMessage('') }} onConfirm={() => { void confirmed() }} />
    <ConfirmDialog open={confirm?.kind === 'transfer'} busy={saving} error={confirm ? message : ''}
      title={`${confirm?.member.name ?? ''}님에게 ${titles.president} 직급을 넘길까요?`}
      description={`넘기면 나는 직급이 없어지고, ${titles.president}만 하던 일은 넘겨받은 사람이 해요.`}
      confirmLabel="넘기기" onCancel={() => { setConfirm(null); setMessage('') }} onConfirm={() => { void confirmed() }} />
  </div>
}
