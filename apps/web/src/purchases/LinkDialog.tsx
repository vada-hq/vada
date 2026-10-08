import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  open: boolean; links: string; busy: boolean; disabled: boolean; error: string
  onLinksChange: (value: string) => void; onClose: () => void; onCreate: (links: string[]) => void
}
// 브라우저 <dialog>를 그대로 쓰고 모양만 Radix 대화상자와 맞춘다. 좌우 1rem을 띄워 좁은 화면에서도 화면 안에 들어온다.
export default function LinkDialog({ open, links, busy, disabled, error, onLinksChange, onClose, onCreate }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const prefix = useId()
  const urls = links.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
  useEffect(() => {
    if (!open) return
    const element = dialog.current!
    const opener = document.activeElement as HTMLElement | null
    element.showModal()
    input.current?.focus()
    return () => { element.close(); if (opener?.isConnected) opener.focus() }
  }, [open])
  return createPortal(<dialog ref={dialog} className="inset-x-4 m-auto w-auto max-w-lg rounded-lg border bg-white p-6 text-foreground shadow-2xl backdrop:bg-black/45" aria-labelledby={prefix}
    aria-describedby={`${prefix}-description`} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="flex items-center justify-between gap-3">
      <h2 id={prefix} className="text-base font-semibold">끼룩이 · 구매 품목 담기</h2>
      <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>닫기</Button>
    </div>
    <p id={`${prefix}-description`} className="mt-2 text-sm text-gray-500">상품 링크와 행사방의 최근 대화를 외부 AI로 처리해요. 링크마다 작성 중 품목이 생겨요.</p>
    <form aria-label="구매 품목 담기" className="mt-6 flex flex-col gap-1.5" onSubmit={event => {
      event.preventDefault()
      if (!busy && !disabled && urls.length > 0 && urls.length <= 5) onCreate(urls)
    }}>
      <Label htmlFor={`${prefix}-links`}>쿠팡 상품 링크</Label>
      <Textarea ref={input} id={`${prefix}-links`} value={links} rows={5} disabled={busy || disabled}
        onChange={event => onLinksChange(event.target.value)} placeholder="주소창의 상품 링크를 한 줄에 하나씩, 최대 5개" />
      {urls.length > 5 && <StateMessage kind="error">상품 링크는 최대 5개까지 입력해 주세요.</StateMessage>}
      {error && <StateMessage kind="error">{error}</StateMessage>}
      {busy && <StateMessage kind="loading">담는 중… 최대 약 75초 걸릴 수 있어요. 끝날 때까지 기다려 주세요.</StateMessage>}
      <Button className="mt-4 self-end" disabled={busy || disabled || !urls.length || urls.length > 5}>담기</Button>
    </form>
  </dialog>, document.body)
}
