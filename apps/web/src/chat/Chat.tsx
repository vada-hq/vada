import { useId, useState } from 'react'
import { useChat } from './useChat'
import Purchases from '../purchases/Purchases'

type Props = { organizationId: string; eventId: string; eventName: string; handlesFinance?: boolean }
export default function Chat(props: Props) {
  return <ChatPanel key={JSON.stringify([props.organizationId, props.eventId])} {...props} />
}

function ChatPanel({ organizationId, eventId, eventName, handlesFinance = false }: Props) {
  const chat = useChat(organizationId, eventId)
  const inputId = useId()
  const [purchasesOpen, setPurchasesOpen] = useState(false)
  const [financeOpen, setFinanceOpen] = useState(false)
  const length = [...chat.draft.trim()].length
  return <section className="chat-panel" aria-label={`${eventName} 대화방`}>
    <h3>{eventName}</h3>
    <p className="hint">대화는 약 3초마다 갱신돼요.</p>
    {chat.nextCursor && <button disabled={chat.busy || chat.denied} onClick={chat.older}>이전 메시지</button>}
    {chat.loading ? <p role="status">대화 불러오는 중…</p> : (
      chat.messages.length ? <ol className="message-list" aria-label="대화 내용">{chat.messages.map(message => <li key={message.id}>
        <div><strong>{message.author.name}</strong> <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('ko-KR')}</time></div>
        <p>{message.content}</p>
      </li>)}</ol> : !chat.loadError && <p>아직 대화가 없어요.</p>
    )}
    {chat.loadError && <p role="alert">{chat.loadError}</p>}
    <button disabled={chat.busy} onClick={chat.refresh}>대화 다시 불러오기</button>
    <form aria-label="메시지 보내기" onSubmit={event => { event.preventDefault(); chat.send() }}>
      <label htmlFor={inputId}>메시지</label>
      <textarea id={inputId} rows={3} value={chat.draft} disabled={chat.denied} onChange={event => chat.setDraft(event.target.value)} />
      <p className="hint">{length} / 2,000자 · 줄바꿈은 Enter, 전송은 버튼을 눌러 주세요.</p>
      <button type="submit" disabled={chat.busy || chat.loading || chat.denied || Boolean(chat.loadError) || length === 0 || length > 2000}>전송</button>
    </form>
    {chat.sendError && <p role="alert">{chat.sendError}</p>}
    {!purchasesOpen && <button disabled={chat.denied || chat.loading} onClick={() => setPurchasesOpen(true)}>끼룩이 · 구매요청서 열기</button>}
    {purchasesOpen && !chat.denied && <Purchases organizationId={organizationId} eventId={eventId} />}
    {handlesFinance && !financeOpen && <button disabled={chat.denied || chat.loading} onClick={() => setFinanceOpen(true)}>재정부 제출 요청 보기</button>}
    {handlesFinance && financeOpen && !chat.denied && <Purchases organizationId={organizationId} eventId={eventId} finance />}
  </section>
}
