import { useEffect, useId, useRef, useState } from 'react'
import { CreateMessageSchema, MESSAGE_CONTENT_MAX, codePoints, type CoupangLink } from '@vada/contracts'
import { cn } from '@/lib/utils'
import MessageText from './MessageText'
import { useChat } from './useChat'
import StateMessage from '@/components/StateMessage'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  organizationId: string
  eventId: string
  eventName: string
  // 메시지의 쿠팡 상품 링크를 누르면 부른다.
  onOpenLink?: (link: CoupangLink) => void
  // 후보에서 고른 메시지. id가 바뀔 때마다 그 메시지를 찾아 강조한다.
  focus?: { id: number; messageId: string } | null
}
export default function Chat(props: Props) {
  return <ChatPanel key={JSON.stringify([props.organizationId, props.eventId])} {...props} />
}

// 와이어프레임에 말풍선 디자인이 없어 같은 디자인 언어(아바타, 이름 600, 시간 회색 작은 글)로 목록형 메시지를 그린다.
function ChatPanel({ organizationId, eventId, eventName, onOpenLink, focus }: Props) {
  const chat = useChat(organizationId, eventId)
  const inputId = useId()
  const length = codePoints(chat.draft.trim())
  const list = useRef<HTMLOListElement>(null)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const { reveal } = chat
  useEffect(() => {
    if (!focus) return
    let cancelled = false
    setMissing(false)
    void reveal(focus.messageId).then(found => {
      if (cancelled) return
      if (found) setHighlighted(focus.messageId)
      else setMissing(true)
    })
    return () => { cancelled = true }
    // focus.id가 바뀔 때만 다시 찾는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.id])
  useEffect(() => {
    if (!highlighted) return
    const element = [...(list.current?.querySelectorAll<HTMLElement>('[data-message-id]') ?? [])].find(item => item.dataset.messageId === highlighted)
    element?.scrollIntoView?.({ block: 'center' })
    const timer = setTimeout(() => setHighlighted(null), 2000)
    return () => clearTimeout(timer)
  }, [highlighted])
  return <section className="flex min-h-0 flex-1 flex-col" aria-label={`${eventName} 대화방`}>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6" tabIndex={0} role="region" aria-label="대화 기록">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">함께 준비하는 공간</h2>
          <p className="text-xs text-gray-400">대화는 약 3초마다 갱신돼요.</p>
        </div>
        {chat.nextCursor && <Button variant="outline" size="sm" className="self-center" disabled={chat.busy || chat.denied} onClick={chat.older}>이전 메시지</Button>}
        {chat.loading ? <StateMessage kind="loading">대화 불러오는 중…</StateMessage> : (
          chat.messages.length ? <ol ref={list} className="flex flex-col" aria-label="대화 내용">{chat.messages.map(message => <li key={message.id}
            data-message-id={message.id} className={cn('flex gap-2 border-b border-gray-100 py-3 last:border-b-0', highlighted === message.id && 'bg-yellow-50')}>
            <Avatar />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <strong className="min-w-0 text-sm font-semibold wrap-anywhere text-gray-900">{message.author.name}</strong>
                <time className="text-xs text-gray-400" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('ko-KR')}</time>
              </div>
              <p className="mt-0.5 text-sm wrap-anywhere whitespace-pre-wrap text-gray-700"><MessageText content={message.content} onOpenLink={onOpenLink} /></p>
            </div>
          </li>)}</ol> : !chat.loadError && <StateMessage kind="empty">아직 대화가 없어요.</StateMessage>
        )}
        {missing && <StateMessage kind="notice">메시지를 찾지 못했어요.</StateMessage>}
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
