import type { DepartmentRank, TeamMember } from '@vada/contracts'
import { PEOPLE_ERRORS, SAVE_FAILED } from '@/lib/messages'
import type { Team } from './useTeam'

// 화면이 오래됐다는 충돌 오류: 같은 요청을 다시 보내도 같은 답이므로 확인 대화상자를 닫고 목록을 다시 읽는다.
const staleConflicts = new Set([
  'PRESIDENT_CANNOT_LEAVE',
  'CANNOT_REMOVE_SELF',
  'ALREADY_PRESIDENT',
])
// 화면이 오래됐다는 답: 같은 요청을 다시 보내도 소용없으므로 확인 대화상자를 닫는다. 권한·없음 오류는 useTeam이 목록을 다시 읽는다.
export const isStale = (code: string) =>
  code === 'FORBIDDEN' || code === 'NOT_FOUND' || staleConflicts.has(code)

export const memberPath = (member: TeamMember) => `/members/${encodeURIComponent(member.id)}`

// 사람 화면이 서버에 보내는 변경. 실패하면 오류 코드를, 성공하면 null을 돌려준다. 실패하면 문구를 보여 준다.
// 내 직급이 바뀌면 학생회를 다시 읽어 권한을 새로 받는다.
export function usePeopleRequests(
  team: Team,
  me: string,
  onCouncilChanged: () => void,
  setMessage: (message: string) => void,
) {
  async function run(path: string, body: unknown, changesMe = false) {
    setMessage('')
    const code = await team.change(path, body)
    if (code) {
      setMessage(PEOPLE_ERRORS[code] ?? SAVE_FAILED)
      if (staleConflicts.has(code)) team.reload()
      return code
    }
    if (changesMe) onCouncilChanged()
    return null
  }
  return {
    run,
    assign: (member: TeamMember, departmentId: string, rank: DepartmentRank | null) => {
      void run(`${memberPath(member)}/departments`, { departmentId, rank }, member.id === me)
    },
    removeFrom: (member: TeamMember, departmentId: string) => {
      void run(
        `${memberPath(member)}/departments/${encodeURIComponent(departmentId)}/remove`,
        {},
        member.id === me,
      )
    },
    toggleViceRank: (member: TeamMember) => {
      const rank = member.councilRank === 'vice_president' ? null : 'vice_president'
      void run(`${memberPath(member)}/rank`, { rank }, member.id === me)
    },
  }
}
