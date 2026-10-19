import { useEffect, useState } from 'react'
import { Ellipsis } from 'lucide-react'
import type { Action, CouncilView, DepartmentRank, TeamMember } from '@vada/contracts'
import { Avatar } from '@/components/Avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { useReveal } from '@/lib/use-reveal'
import InviteCard from './InviteCard'
import MemberDepartmentsDialog from './MemberDepartmentsDialog'
import { councilRankLabel, holdsRank, joinedDay, placementsText } from './team-view'
import { useMenuFocus } from './use-menu-focus'
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
// 화면이 오래됐다는 409: 같은 요청을 다시 보내도 같은 답이므로 확인 대화상자를 닫고 목록을 다시 읽는다.
const staleConflicts = new Set([
  'PRESIDENT_CANNOT_LEAVE',
  'CANNOT_REMOVE_SELF',
  'ALREADY_PRESIDENT',
])
// 화면이 오래됐다는 답: 같은 요청을 다시 보내도 소용없으므로 확인 대화상자를 닫는다. 403·404는 useTeam이 목록을 다시 읽는다.
const stale = new Set(['FORBIDDEN', 'NOT_FOUND', ...staleConflicts])
type Confirm = { kind: 'remove' | 'transfer'; memberId: string }

type Props = { view: CouncilView; team: Team; onCouncilChanged: () => void }

// 운영진 > 사람: 이름, 직급(학생회가 정한 표시 이름), 부서와 부서 직급, 들어온 날. 들어온 순서대로다(DEC-47).
// 회장단은 초대 링크와 줄마다 ⋯ 메뉴(부서 배정, 직급, 내보내기)를 보고, 회장은 회장 넘기기를 더 본다.
// 동작 버튼은 서버가 준 내 권한 목록으로만 보이거나 숨긴다(DEC-38). 대화상자는 대상이 목록에 있고 권한이 있을 때만 열려 있다.
export default function People({ view, team, onCouncilChanged }: Props) {
  const { data, loadFailed, saving, change, reload } = team
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const menuFocus = useMenuFocus()
  const titles = view.council.titles
  const me = view.me.memberId
  const can = (action: Action) => view.permissions.includes(action)
  // 내보내기: 서버와 같이 직급이 붙은 사람은 member.manage에 더해 rank.manage도 있어야 한다. 회장과 나는 내보낼 수 없다.
  const removable = (member: TeamMember) =>
    can('member.manage') &&
    member.councilRank !== 'president' &&
    member.id !== me &&
    (!holdsRank(member) || can('rank.manage'))

  // 다시 읽은 목록과 권한으로 매번 대상을 찾는다. 대상이 사라졌거나 권한을 잃으면 대화상자는 닫힌다.
  const members = data?.members
  const editingMember = can('member.manage')
    ? (members?.find(member => member.id === editing) ?? null)
    : null
  const target = confirm ? members?.find(member => member.id === confirm.memberId) : undefined
  const confirming =
    confirm &&
    target &&
    target.id !== me &&
    (confirm.kind === 'remove' ? removable(target) : can('president.transfer'))
      ? { kind: confirm.kind, member: target }
      : null
  const editingGone = data !== null && editing !== null && !editingMember
  const confirmGone = data !== null && confirm !== null && !confirming
  // 대화상자 안에 보이지 않는 오류만 쪽 위에 보인다. 문구가 쪽에 나타나면 화면 안으로 스크롤한다.
  const pageMessage = !editingMember && !confirming ? message : ''
  const messageRef = useReveal<HTMLDivElement>(pageMessage)
  // 닫힌 대화상자의 대상을 지운다. 나중에 같은 운영진이 다시 목록에 나타나도 대화상자가 저절로 열리지 않게 한다.
  useEffect(() => {
    if (editingGone) setEditing(null)
  }, [editingGone])
  useEffect(() => {
    if (confirmGone) setConfirm(null)
  }, [confirmGone])
  if (!data)
    return loadFailed ? (
      <Card className="flex flex-col gap-3 p-6">
        <StateMessage kind="error">운영진을 불러오지 못했어요.</StateMessage>
        <Button variant="outline" className="self-start" onClick={reload}>
          다시 시도
        </Button>
      </Card>
    ) : (
      <StateMessage kind="loading">운영진 불러오는 중…</StateMessage>
    )
  const current = data

  // 실패하면 오류 코드를, 성공하면 null을 돌려준다. 실패하면 문구를 보여 준다. 내 직급이 바뀌면 학생회를 다시 읽어 권한을 새로 받는다.
  async function run(path: string, body: unknown, changesMe = false) {
    setMessage('')
    const code = await change(path, body)
    if (code) {
      setMessage(errors[code] ?? failure)
      if (staleConflicts.has(code)) reload()
      return code
    }
    if (changesMe) onCouncilChanged()
    return null
  }
  const memberPath = (member: TeamMember) => `/members/${encodeURIComponent(member.id)}`
  function assign(member: TeamMember, departmentId: string, rank: DepartmentRank | null) {
    void run(`${memberPath(member)}/departments`, { departmentId, rank }, member.id === me)
  }
  function removeFrom(member: TeamMember, departmentId: string) {
    void run(
      `${memberPath(member)}/departments/${encodeURIComponent(departmentId)}/remove`,
      {},
      member.id === me,
    )
  }
  async function confirmed() {
    if (!confirming || saving) return
    const code =
      confirming.kind === 'remove'
        ? await run(`${memberPath(confirming.member)}/remove`, {})
        : await run('/president/transfer', { memberId: confirming.member.id }, true)
    if (code === null || stale.has(code)) setConfirm(null)
  }
  const askConfirm = (kind: Confirm['kind'], member: TeamMember) => {
    setMessage('')
    menuFocus.remember(member.id)
    setConfirm({ kind, memberId: member.id })
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {can('invite.manage') && (
        <InviteCard councilId={view.council.id} onForbidden={onCouncilChanged} />
      )}
      <h2 className="text-base font-semibold text-gray-900">운영진 {current.members.length}명</h2>
      {pageMessage && (
        <div ref={messageRef}>
          <StateMessage kind="error">{pageMessage}</StateMessage>
        </div>
      )}
      <Card className="overflow-hidden">
        <ul aria-label="운영진" className="divide-y">
          {current.members.map(member => {
            const rank = councilRankLabel(member.councilRank, titles)
            const placements = placementsText(member, current.departments, titles)
            const president = member.councilRank === 'president'
            // 항목마다 그 동작의 권한으로 보인다. 항목이 하나도 없으면 ⋯ 메뉴도 없다.
            const canAssign = can('member.manage')
            const canRankChange = can('rank.manage') && !president
            const canTransfer = can('president.transfer') && member.id !== me
            const canRemove = removable(member)
            return (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm wrap-anywhere text-gray-900">
                    {member.name}
                    {rank && <Badge tone="info">{rank}</Badge>}
                  </p>
                  <p className="text-xs wrap-anywhere text-gray-500">
                    {placements || '부서 없음'} · {joinedDay(member.joinedAt)} 들어옴
                  </p>
                </div>
                {(canAssign || canRankChange || canTransfer) && (
                  <Menu>
                    <MenuTrigger asChild>
                      <Button
                        ref={menuFocus.triggerRef(member.id)}
                        variant="ghost"
                        size="icon"
                        aria-label={`${member.name} 동작`}
                        disabled={saving}
                      >
                        <Ellipsis />
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      {canAssign && (
                        <MenuItem
                          onSelect={() => {
                            setMessage('')
                            menuFocus.remember(member.id)
                            setEditing(member.id)
                          }}
                        >
                          부서 배정
                        </MenuItem>
                      )}
                      {canRankChange && (
                        <MenuItem
                          onSelect={() => {
                            void run(
                              `${memberPath(member)}/rank`,
                              {
                                rank:
                                  member.councilRank === 'vice_president' ? null : 'vice_president',
                              },
                              member.id === me,
                            )
                          }}
                        >
                          {member.councilRank === 'vice_president'
                            ? `${titles.vicePresident} 직급 거두기`
                            : `${titles.vicePresident} 직급 주기`}
                        </MenuItem>
                      )}
                      {canTransfer && (
                        <MenuItem onSelect={() => askConfirm('transfer', member)}>
                          {titles.president} 넘기기
                        </MenuItem>
                      )}
                      {canRemove && (
                        <MenuItem destructive onSelect={() => askConfirm('remove', member)}>
                          내보내기
                        </MenuItem>
                      )}
                    </MenuContent>
                  </Menu>
                )}
              </li>
            )
          })}
        </ul>
      </Card>
      {editingMember && (
        <MemberDepartmentsDialog
          key={editingMember.id}
          member={editingMember}
          departments={current.departments}
          titles={titles}
          saving={saving}
          canRank={can('rank.manage')}
          error={message}
          onClose={() => {
            setEditing(null)
            setMessage('')
          }}
          onCloseAutoFocus={menuFocus.onCloseAutoFocus}
          onAssign={(departmentId, rank) => assign(editingMember, departmentId, rank)}
          onRemove={departmentId => removeFrom(editingMember, departmentId)}
        />
      )}
      <ConfirmDialog
        open={confirming?.kind === 'remove'}
        destructive
        busy={saving}
        error={confirming ? message : ''}
        title={`${confirming?.member.name ?? ''}님을 내보낼까요?`}
        description="학생회 소속과 부서 소속이 함께 끝나요. 초대 링크로 다시 들어올 수 있지만, 부서와 직급은 다시 정해야 해요."
        confirmLabel="내보내기"
        onCloseAutoFocus={menuFocus.onCloseAutoFocus}
        onCancel={() => {
          setConfirm(null)
          setMessage('')
        }}
        onConfirm={() => {
          void confirmed()
        }}
      />
      <ConfirmDialog
        open={confirming?.kind === 'transfer'}
        busy={saving}
        error={confirming ? message : ''}
        title={`${confirming?.member.name ?? ''}님에게 ${titles.president} 직급을 넘길까요?`}
        description={`넘기면 나는 직급이 없어지고, ${titles.president}만 하던 일은 넘겨받은 사람이 해요.`}
        confirmLabel="넘기기"
        onCloseAutoFocus={menuFocus.onCloseAutoFocus}
        onCancel={() => {
          setConfirm(null)
          setMessage('')
        }}
        onConfirm={() => {
          void confirmed()
        }}
      />
    </div>
  )
}
