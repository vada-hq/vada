import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import StateMessage from '../shared/ui/StateMessage'

type Props = {
  open: boolean; links: string; busy: boolean; disabled: boolean; error: string
  onLinksChange: (value: string) => void; onClose: () => void; onCreate: (links: string[]) => void
}
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
  return createPortal(<dialog ref={dialog} className="link-dialog" aria-labelledby={prefix}
    aria-describedby={`${prefix}-description`} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header className="purchase-toolbar"><h2 id={prefix}>끼룩이 · 구매요청서 초안</h2>
      <button className="button-quiet" disabled={busy} onClick={onClose}>닫기</button></header>
    <p id={`${prefix}-description`} className="hint">상품 링크와 현재 행사방의 최근 대화를 외부 AI로 처리해요. 생성된 초안을 확인·수정한 후 제출해 주세요.</p>
    <form aria-label="구매 초안 생성" onSubmit={event => {
      event.preventDefault()
      if (!busy && !disabled && urls.length > 0 && urls.length <= 5) onCreate(urls)
    }}>
      <label htmlFor={`${prefix}-links`}>쿠팡 상품 링크</label>
      <textarea ref={input} id={`${prefix}-links`} value={links} rows={5} disabled={busy || disabled}
        onChange={event => onLinksChange(event.target.value)} placeholder="주소창의 상품 링크를 한 줄에 하나씩, 최대 5개" />
      {urls.length > 5 && <StateMessage kind="error">상품 링크는 최대 5개까지 입력해 주세요.</StateMessage>}
      {error && <StateMessage kind="error">{error}</StateMessage>}
      {busy && <StateMessage kind="loading">초안 생성 중… 최대 약 75초 걸릴 수 있어요. 완료될 때까지 기다려 주세요.</StateMessage>}
      <button disabled={busy || disabled || !urls.length || urls.length > 5}>초안 만들기</button>
    </form>
  </dialog>, document.body)
}
