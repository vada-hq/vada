import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { RoomParticipant } from '@vada/contracts'
import { insertMention, mentionQuery, suggestions } from './mention'
import type { Composer } from './useComposer'

// 글 입력칸의 '@' 부르기: 커서 앞의 "@글자"로 참여자 목록(나 제외)을 거르고, 고르면 이름을 넣고 커서를 그 뒤로 옮긴다.
export function useMentionInput(composer: Composer, participants: RoomParticipant[], meId: string) {
  const { body, setBody, pick } = composer
  const [caret, setCaret] = useState(0)
  const [pendingCaret, setPendingCaret] = useState<number | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (pendingCaret === null) return
    field.current?.focus()
    field.current?.setSelectionRange(pendingCaret, pendingCaret)
    setPendingCaret(null)
  }, [pendingCaret])

  const query = mentionQuery(body, caret)
  const people = query ? suggestions(participants, query.query, meId) : []

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setBody(event.target.value)
    setCaret(event.target.selectionStart)
  }
  const onPick = (person: RoomParticipant) => {
    const next = insertMention(body, caret, person.name)
    setBody(next.text)
    setCaret(next.caret)
    setPendingCaret(next.caret)
    pick(person)
  }
  return { field, people, onChange, onPick, onSelect: setCaret }
}
