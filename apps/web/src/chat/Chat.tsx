import { useId } from 'react'
import { CreateMessageSchema, MESSAGE_CONTENT_MAX, codePoints } from '@vada/contracts'
import { useChat } from './useChat'
import StateMessage from '@/components/StateMessage'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = { organizationId: string; eventId: string; eventName: string }
export default function Chat(props: Props) {
  return <ChatPanel key={JSON.stringify([props.organizationId, props.eventId])} {...props} />
}

// 와이어프레임에 말풍선 디자인이 없어 같은 디자인 언어(아바타, 이름 600, 시간 회색 작은 글)로 목록형 메시지를 그린다.
function ChatPanel({ organizationId, eventId, eventName }: Props) {
  const chat = useChat(organizationId, eventId)
  const inputId = useId()
  const length = codePoints(chat.draft.trim())
  return <section className="flex min-h-0 flex-1 flex-col" aria-label={`${eventName} 대화방`}>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6" tabIndex={0} role="region" aria-label="대화 기록">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">함께 준비하는 공간</h2>
          <p className="text-xs text-gray-400">대화는 약 3초마다 갱신돼요.</p>
        </div>
        {chat.nextCursor && <Button variant="outline" size="sm" className="self-center" disabled={chat.busy || chat.denied} onClick={chat.older}>이전 메시지</Button>}
        {chat.loading ? <StateMessage kind="loading">대화 불러오는 중…</StateMessage> : (
          chat.messages.length ? <ol className="flex flex-col" aria-label="대화 내용">{chat.messages.map(message => <li key={message.id} className="flex gap-2 border-b border-gray-100 py-3 last:border-b-0">
            <Avatar />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <strong className="min-w-0 text-sm font-semibold wrap-anywhere text-gray-900">{message.author.name}</strong>
                <time className="text-xs text-gray-400" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('ko-KR')}</time>
              </div>
              <p className="mt-0.5 text-sm wrap-anywhere whitespace-pre-wrap text-gray-700">{message.content}</p>
            </div>
          </li>)}</ol> : !chat.loadError && <StateMessage kind="empty">아직 대화가 없어요.</StateMessage>
        )}
        {chat.loadError && <StateMessage kind="error">{chat.loadError}</StateMessage>}
        <Button variant="ghost" size="sm" className="self-start" disabled={chat.busy} onClick={chat.refresh}>대화 다시 불러오기</Button>
      </div>
    </div>
    <form className="shrink-0 border-t px-4 py-3 sm:px-6" aria-label="메시지 보내기" onSubmit={event => { event.preventDefault(); chat.send() }}>
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <Label htmlFor={inputId} className="sr-only">메시지</Label>
        <Textarea id={inputId} rows={3} className="max-h-40" placeholder="행사 준비 이야기를 나눠 주세요" value={chat.draft} disabled={chat.denied} onChange={event => chat.setDraft(event.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-400">{length} / {MESSAGE_CONTENT_MAX.toLocaleString('ko-KR')}자 · 줄바꿈은 Enter, 전송은 버튼을 눌러 주세요.</p>
          <Button type="submit" disabled={chat.busy || chat.loading || chat.denied || Boolean(chat.loadError) || !CreateMessageSchema.safeParse({ content: chat.draft }).success}>전송</Button>
        </div>
        {chat.sendError && <StateMessage kind="error">{chat.sendError}</StateMessage>}
      </div>
    </form>
  </section>
}
