import type { KeyboardEvent } from 'react'
import { directMatches, slashQuery } from './direct-query'
import { useDirectOpener, type DirectPerson } from './direct-open'

// 입력칸의 '/이름'(022 조각 7, 부르기 '@'의 useMentionInput과 같은 방식): 첫 글자가 '/'면 보내지 않고 운영진 목록을 거른다.
// 고르면 입력칸을 비우고 그 사람과 1:1을 열며, '/이름' 뒤에 친 글은 그 1:1 입력칸으로 옮긴다.
// 1:1을 열 수 없는 곳(people이 null)에서는 '/'도 보통 글이다.
export function useDirectInput(body: string, setBody: (body: string) => void) {
  const opener = useDirectOpener()
  const found = opener ? slashQuery(body) : null
  const people = opener && found ? directMatches(opener.people, found.query, opener.meId) : null
  const pick = (person: DirectPerson) => {
    if (!opener || !found) return
    setBody('')
    opener.open(person, found.rest)
  }
  // Enter는 보내지 않고 첫 사람을 연다(와이어프레임 MSG-04). 한글 조합 중의 Enter와 Shift+Enter는 그대로 둔다.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    const first = people?.[0]
    if (first) pick(first)
  }
  return { people, pick, onKeyDown }
}
