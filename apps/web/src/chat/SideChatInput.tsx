import { useContext } from 'react'
import type { RoomParticipant } from '@vada/contracts'
import { keepDraft } from './composer-drafts'
import { directQuery, suggestions } from './mention'
import { SideChatContext } from './SideChatContext'
import type { Composer } from './useComposer'

// 1:1 모드의 이름은 지금 방 참여자가 아니라 운영진 전체에서 찾는다.
export function useDirectInput(
  composer: Composer,
  ids: { councilId: string; roomId: string; meId: string },
) {
  const access = useContext(SideChatContext)
  const query = access?.canDirect ? directQuery(composer.body) : null
  const people = query !== null && access ? suggestions(access.members, query, ids.meId) : []
  const pick = async (person: RoomParticipant) => {
    await access?.open(person.memberId, () => {
      // 휴대폰에서 원래 방이 곧 사라져도 /이름이 초안으로 되살아나지 않게 먼저 비운다.
      keepDraft(ids.meId, ids.councilId, ids.roomId, { body: '', picks: [] })
      composer.setBody('')
    })
  }
  return {
    active: query !== null,
    people,
    pick,
    busy: access?.busy ?? false,
    canDirect: access?.canDirect ?? false,
  }
}
