import { MENTION_MAX, type RoomParticipant } from '@vada/contracts'

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

// 고른 사람 가운데 본문에 아직 "@이름"이 남은 사람만 부른다. 지운 이름은 부르지 않는다.
export function mentionIds(body: string, picks: RoomParticipant[]): string[] {
  const ids = new Set<string>()
  for (const pick of picks) if (body.includes(`@${pick.name}`)) ids.add(pick.memberId)
  return [...ids].slice(0, MENTION_MAX)
}

export function suggestions(people: RoomParticipant[], query: string, meId: string) {
  return people.filter(person => person.memberId !== meId && person.name.includes(query))
}
