import type { ChatMessage, EventRoomsResponse } from '@vada/contracts'
import { create, read } from '../rehearsal-kit.js'
import type { MessageEntry } from './content/types.js'
import { departmentId, eventId, org, who, type ShowcaseCtx } from './kit.js'

// 대화: 보낸 사람이 자기 행사 방 목록에서 방을 찾아 보낸다. 방이 목록에 없으면(참여자가 아니면) 던진다.
export async function messageStep(ctx: ShowcaseCtx, entry: MessageEntry) {
  const person = who(ctx, entry.by)
  const { rooms } = await read<EventRoomsResponse>(
    person,
    `${org(ctx)}/events/${eventId(ctx, entry.room.event)}/rooms`,
    '행사 방 읽기',
  )
  const wanted = entry.room.department ? departmentId(ctx, entry.room.department) : null
  const room = rooms.find(item =>
    wanted
      ? item.type === 'department' && item.departmentId === wanted
      : item.type === 'all_members',
  )
  if (!room)
    throw new Error(
      `${entry.by}의 방 목록에 '${entry.room.event}' ${entry.room.department ?? '전체'}방이 없다`,
    )
  const sent = await create<ChatMessage>(
    person,
    `${org(ctx)}/rooms/${room.id}/messages`,
    { body: ctx.cal.text(entry.text) },
    '메시지 보내기',
  )
  if (entry.key) ctx.w.messages.set(entry.key, sent.id)
}
