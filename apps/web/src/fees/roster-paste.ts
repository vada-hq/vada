import { REGISTRATION_NAME_MAX, studentIdInput, text, type DuesMember } from '@vada/contracts'

export type RosterProblemReason = 'shape' | 'studentId' | 'name' | 'conflict'
export interface RosterProblem { line: number; reason: RosterProblemReason }
export interface RosterParse {
  members: DuesMember[]
  // 같은 학번·같은 이름이라 하나로 합친 줄 수
  merged: number
  problems: RosterProblem[]
}

const nameInput = text(REGISTRATION_NAME_MAX)
// 이름 비교 열쇠: 서버의 명단 대조와 같게 공백을 빼고 영문 대소문자를 가리지 않는다.
const nameKey = (name: string) => name.replace(/\s/g, '').toLowerCase()
const studentIdOf = (cell: string) => {
  const parsed = studentIdInput.safeParse(cell)
  return parsed.success ? parsed.data : null
}

// 엑셀에서 복사한 학번·이름 두 칸을 읽는다. 칸은 탭이나 쉼표로 나뉘고 순서는 어느 쪽이든 된다.
// 첫 줄이 "학번"을 담은 제목이면 건너뛴다. 문제가 있는 줄은 명단에 넣지 않고 원래 줄 번호로 알린다.
export function parseRoster(source: string): RosterParse {
  const members: DuesMember[] = []
  const seen = new Map<string, string>()
  const problems: RosterProblem[] = []
  let merged = 0
  let first = true
  source.split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim()) return
    const header = first
    first = false
    const line = index + 1
    const cells = raw.split(/[\t,]/).map(cell => cell.trim()).filter(Boolean)
    if (cells.length !== 2) {
      problems.push({ line, reason: 'shape' })
      return
    }
    const ids = cells.map(studentIdOf)
    const at = ids.findIndex(id => id !== null)
    if (at < 0) {
      if (!(header && raw.includes('학번'))) problems.push({ line, reason: 'studentId' })
      return
    }
    const studentId = ids[at]!
    const other = cells[1 - at]!
    const name = nameInput.safeParse(other)
    // 두 칸이 모두 학번 모양이면 이름 칸이 없는 것이다.
    if (!name.success || ids[1 - at] !== null) {
      problems.push({ line, reason: 'name' })
      return
    }
    const known = seen.get(studentId)
    if (known === undefined) {
      seen.set(studentId, nameKey(name.data))
      members.push({ studentId, name: name.data })
    } else if (known === nameKey(name.data)) merged++
    else problems.push({ line, reason: 'conflict' })
  })
  return { members, merged, problems }
}
