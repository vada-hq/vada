import { Blocked } from '../errors.ts'

/**
 * 화면이 초안에 쓰는 자리 이름.
 *
 * 되풀이되는 부서의 칸은 `departments.<부서>.<칸>`으로 온다(`payloadOf`가 적어 둔 규칙 —
 * 계약의 칸 이름은 마지막 조각이다). 부원 목록은 `EVT03BScreen`의 memberKey와 같고
 * 사람은 줄바꿈으로 잇는다. 두 벌이 갈리는 것은 화면에서 완료를 눌러 저장하는 통합
 * 검사가 잡는다(`events.server.test.tsx`).
 */
const DEPARTMENT_LIST = 'departments'
const SEPARATOR = '\n'

/** 부서 하나에 실려 온 것. 셋 다 없을 수 있다 — 없는 것은 안 건드린다. */
export interface DepartmentDraft {
  /** 그 부서의 부원 전부. 있으면 **그 목록이 그 부서의 부원이다** — 빠진 사람은 나간다. */
  members?: string[]
  /** 새 부서장. 부서마다 0명 또는 1명이라 앞의 부서장은 부원이 된다. */
  leaderId?: string
  /** '＋ 구성원 추가'로 고른 사람. */
  addMemberId?: string
}

function idsOf(holder: string, value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((one) => String(one).trim()).filter((one) => one !== '')
  }
  if (typeof value !== 'string') throw new Blocked(`'${holder}' 자리의 값이 글이 아닙니다`)
  return value
    .split(SEPARATOR)
    .map((id) => id.trim())
    .filter((id) => id !== '')
}

/**
 * `departments.<부서>.<칸>` 꼴의 열쇠를 부서마다 모은다.
 *
 * 모르는 칸은 건너뛴다 — 화면이 제 자리 이름(leaders·unassigned)도 함께 보내는데 그것은
 * 배치의 원본이 아니라 그린 것의 자취다. 배치는 부서마다의 목록과 책임자 칸이 말한다.
 */
export function eventStaffDepartmentDrafts(draft: Record<string, unknown>): Map<string, DepartmentDraft> {
  const found = new Map<string, DepartmentDraft>()
  for (const [key, value] of Object.entries(draft)) {
    if (!key.startsWith(`${DEPARTMENT_LIST}.`)) continue
    const dot = key.lastIndexOf('.')
    const departmentId = key.slice(DEPARTMENT_LIST.length + 1, dot)
    const field = key.slice(dot + 1)
    if (departmentId === '') continue
    const entry = found.get(departmentId) ?? {}
    if (field === 'members') {
      entry.members = idsOf(key, value)
    } else if (field === 'departmentLeaderId' || field === 'departmentMemberId') {
      const id = typeof value === 'string' ? value.trim() : ''
      if (id === '') continue
      if (field === 'departmentLeaderId') entry.leaderId = id
      else entry.addMemberId = id
    } else {
      continue
    }
    found.set(departmentId, entry)
  }
  return found
}

export interface StaffPlace {
  department: string | null
  leader: boolean
  eventLeader: boolean
}
