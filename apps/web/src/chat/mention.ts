import { MENTION_MAX, type RoomParticipant } from '@vada/contracts'

// /이름 뒤에 공백을 쓰면 보통 글이다. 문장 속의 /도 보내기를 가로막지 않는다.
export const directQuery = (body: string) => (/^\/\S*$/.test(body) ? body.slice(1) : null)

// 커서 앞에서 이어지는 "@글자"를 찾는다. 앞이 글자이면(메일 주소처럼) 부르기가 아니다.
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret)
  const start = before.lastIndexOf('@')
  if (start < 0) return null
  const query = before.slice(start + 1)
  if (/\s/.test(query)) return null
  if (start > 0 && !/\s/.test(before.charAt(start - 1))) return null
  return { start, query }
}

// 고른 이름을 "@이름 "으로 바꿔 넣는다.
export function insertMention(text: string, caret: number, name: string) {
  const found = mentionQuery(text, caret)
  const start = found?.start ?? caret
  const inserted = `@${name} `
  return {
    text: text.slice(0, start) + inserted + text.slice(caret),
    caret: start + inserted.length,
  }
}

// "@이름" 바로 뒤에 글자가 이어지면 다른 이름이다("@김민수"는 "김민"을 부르지 않는다).
const NAME_CHAR = /[\p{L}\p{N}]/u
function isCalled(body: string, name: string) {
  const token = `@${name}`
  for (let at = body.indexOf(token); at >= 0; at = body.indexOf(token, at + 1)) {
    const next = body.charAt(at + token.length)
    if (next === '' || !NAME_CHAR.test(next)) return true
  }
  return false
}

// 고른 사람 가운데 본문에 아직 "@이름"이 남은 사람만 부른다. 지운 이름은 부르지 않는다.
export function mentionIds(body: string, picks: RoomParticipant[]): string[] {
  const ids = new Set<string>()
  for (const pick of picks) if (isCalled(body, pick.name)) ids.add(pick.memberId)
  return [...ids].slice(0, MENTION_MAX)
}

export function suggestions(people: RoomParticipant[], query: string, meId: string) {
  return people.filter(person => person.memberId !== meId && person.name.includes(query))
}
