import { useState } from 'react'
import { DEPARTMENT_ERRORS, SAVE_FAILED } from '@/lib/messages'
import type { Team } from './useTeam'

// 같은 요청을 다시 보내도 같은 답이 오는 경우: 화면이 오래됐거나(권한이 바뀜, 부서가 없어짐) 부서원이 있었던 부서다.
const final = new Set(['FORBIDDEN', 'NOT_FOUND', 'DEPARTMENT_IN_USE'])
export const isFinal = (code: string) => final.has(code)

// 오류를 보일 자리: 만들기 칸 아래, 열린 대화상자 안, 쪽 위.
export type Scope = 'create' | 'rename' | 'remove' | 'list'
type Problem = { scope: Scope; text: string }

// 부서 화면이 서버에 보내는 변경과 그 오류 문구. 실패하면 오류 코드를, 성공하면 null을 돌려준다.
// 오류는 동작한 자리에 보이고, 다시 보내도 소용없는 오류는 쪽 위에 보인다.
// 권한이 바뀌었다는 답은 만들기 칸이나 대화상자와 함께 그 자리가 사라질 수 있어 쪽 위에 보인다.
export function useDepartmentRequests(change: Team['change']) {
  const [problem, setProblem] = useState<Problem | null>(null)
  async function run(path: string, body: unknown, scope: Scope) {
    setProblem(null)
    const code = await change(path, body)
    if (code)
      setProblem({
        scope: final.has(code) ? 'list' : scope,
        text: DEPARTMENT_ERRORS[code] ?? SAVE_FAILED,
      })
    return code
  }
  return {
    run,
    problemIn: (scope: Scope) => (problem?.scope === scope ? problem.text : ''),
    // 서버 답이 아니라 화면이 알아챈 일(대상이 사라짐, 권한을 잃음)의 까닭을 쪽 위에 보인다.
    report: (text: string) => setProblem({ scope: 'list', text }),
    clear: () => setProblem(null),
    clearIn: (scope: Scope) => setProblem(current => (current?.scope === scope ? null : current)),
  }
}
