import { useId } from 'react'
import { CreateMessageSchema, MESSAGE_CONTENT_MAX, codePoints } from '@vada/contracts'
import { useChat } from './useChat'
import StateMessage from '../shared/ui/StateMessage'
import './Chat.css'

type Props = { organizationId: string; eventId: string; eventName: string }
export default function Chat(props: Props) {
  return <ChatPanel key={JSON.stringify([props.organizationId, props.eventId])} {...props} />
}

function ChatPanel({ organizationId, eventId, eventName }: Props) {
  const chat = useChat(organizationId, eventId)
  const inputId = useId()
  const length = codePoints(chat.draft.trim())
  return <section className="chat-panel" aria-label={`${eventName} 대화방`}>
    <div className="chat-history" tabIndex={0} role="region" aria-label="대화 기록">
    <h2>함께 준비하는 공간</h2>
    <p className="hint">대화는 약 3초마다 갱신돼요.</p>
    {chat.nextCursor && <button disabled={chat.busy || chat.denied} onClick={chat.older}>이전 메시지</button>}
    {chat.loading ? <StateMessage kind="loading">대화 불러오는 중…</StateMessage> : (
      chat.messages.length ? <ol className="message-list" aria-label="대화 내용">{chat.messages.map(message => <li key={message.id}>
        <div><strong>{message.author.name}</strong> <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('ko-KR')}</time></div>
        <p>{message.content}</p>
      </li>)}</ol> : !chat.loadError && <StateMessage kind="empty">아직 대화가 없어요.</StateMessage>
    )}
    {chat.loadError && <StateMessage kind="error">{chat.loadError}</StateMessage>}
    <button className="button-quiet" disabled={chat.busy} onClick={chat.refresh}>대화 다시 불러오기</button>
    </div>
    <form className="chat-composer" aria-label="메시지 보내기" onSubmit={event => { event.preventDefault(); chat.send() }}>
      <label htmlFor={inputId}>메시지</label>
      <textarea id={inputId} rows={3} placeholder="행사 준비 이야기를 나눠 주세요" value={chat.draft} disabled={chat.denied} onChange={event => chat.setDraft(event.target.value)} />
      <div className="composer-actions">
      <p className="hint">{length} / {MESSAGE_CONTENT_MAX.toLocaleString('ko-KR')}자 · 줄바꿈은 Enter, 전송은 버튼을 눌러 주세요.</p>
      <button type="submit" disabled={chat.busy || chat.loading || chat.denied || Boolean(chat.loadError) || !CreateMessageSchema.safeParse({ content: chat.draft }).success}>전송</button>
      </div>
      {chat.sendError && <StateMessage kind="error">{chat.sendError}</StateMessage>}
    </form>
  </section>
}
