import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, test } from 'vitest'

// 구조 검사(저장소 AGENTS.md '화면의 권한', DEC-38): 화면은 직급·역할로 보이기를 정하지 않고 서버가 준
// `view.permissions`와 기록의 `actions`만 본다. 시험 아닌 화면 코드에서 직급·역할 비교를 찾아, 허용 목록 밖이면 실패한다.

const SRC = join(__dirname, '..')
const IGNORED_DIRS = new Set(['test-support', 'ui-gallery', '__snapshots__', 'structure'])

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return IGNORED_DIRS.has(name) ? [] : sources(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

// 직급·역할을 읽어 가르는 꼴: 학생회 직급, 부서 직급 비교·참거짓, 역할 비교.
const RANK_CHECKS = [
  /\bcouncilRank\b/,
  /\.rank\s*(?:===|!==|==|!=|&&|\?(?![?.]))/,
  /\brank\s*(?:===|!==)\s*(?:null\b|')/,
  /\brole\s*(?:===|!==)/,
]

// 직급·역할을 읽지만 보이기를 정하지 않는 파일. 가림이 아닌 까닭을 한 줄로 적는다. 이유 없이 더하지 않는다.
const ALLOWED: Record<string, string> = {
  'home/member-view.ts': '부서 배정 전 안내 띠(DEC-87). 무엇도 가리지 않는다',
  'tasks/home-task-scope.ts': '사람이 켠 직급 부서 거르기. 서버가 준 업무를 가리지 않는다',
  'tasks/task-defaults.ts': '빠른 추가의 기본 부서. 서버가 준 선택지 안에서만 고른다',
  'team/DepartmentMenu.tsx': '재정 역할 주기·거두기 메뉴 문구',
  'team/MemberRow.tsx': '직급 배지 색과 부회장 주기·거두기 문구',
  'team/OrgLayout.tsx': '재정 부서 배지와 강조',
  'team/team-view.ts': '직급 표시 이름과 조직 화면의 묶음',
  'team/useDepartmentSubmits.ts': '재정 역할 토글이 보낼 값',
  'team/usePeopleRequests.ts': '부회장 토글이 보낼 값',
  'workspace/SidebarFooter.tsx': '옆 메뉴 발의 직급 라벨',
  'finance/FinancePage.tsx':
    '옮길 것(권한 점검 R1): 구매 요청 부서 보기를 서버 권한 이름으로 바꾼다',
  'team/people-access.ts': '옮길 것(권한 점검 A1~A3): 운영진 줄의 동작을 서버 actions로 바꾼다',
  'team/MemberDepartmentList.tsx': '옮길 것(권한 점검 A4): 부서에서 빼기를 서버 actions로 바꾼다',
}

const code = sources(SRC).map(
  path => [relative(SRC, path).split(sep).join('/'), readFileSync(path, 'utf8')] as const,
)
const checking = (text: string) => RANK_CHECKS.some(pattern => pattern.test(text))

describe('화면은 직급·역할로 보이기를 정하지 않는다', () => {
  test('검사가 화면 코드를 읽었다', () => {
    expect(code.length).toBeGreaterThan(100)
    expect(checking("member.councilRank === 'president'")).toBe(true)
    expect(checking('dept => dept.rank !== null')).toBe(true)
    expect(checking("department.role === 'finance'")).toBe(true)
    expect(checking('const rank = list.indexOf(kind)\nreturn rank === -1')).toBe(false)
  })

  test('허용 목록 밖에 직급·역할 비교가 없다', () => {
    const found = code
      .filter(([path, text]) => !(path in ALLOWED) && checking(text))
      .map(([path]) => path)
    expect(found, `직급·역할로 가르는 파일: ${found.join(', ')}`).toEqual([])
  })

  test('허용 목록은 이유가 있고 여전히 직급·역할을 읽는 파일만 적는다', () => {
    for (const [path, reason] of Object.entries(ALLOWED)) {
      expect(reason.length, path).toBeGreaterThan(0)
      const file = code.find(([name]) => name === path)
      expect(file && checking(file[1]), `${path} 이제 직급·역할을 읽지 않는다. 목록에서 뺀다`).toBe(
        true,
      )
    }
  })
})
