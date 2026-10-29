import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { FormSample } from '../form-data'
import { CLS, HEX, SHADOW, TOAST_MS } from './tokens'

// 종이 한 장 모양의 바탕 부품: 책상(옅은 따뜻한 회색) 위에 흰 종이 한 장. 세 화면이 같이 쓴다.

export function Desk({ children }: { children: ReactNode }) {
  return (
    <main className={CLS.desk} style={{ backgroundColor: HEX.desk }}>
      {children}
    </main>
  )
}

// 종이. band가 있으면 윗변에 강조색 띠(신청·받지 않을 때). 신청 직후는 띠 대신 완료 패널이 윗변을 채운다.
export function Paper({ band, children }: { band?: boolean; children: ReactNode }) {
  return (
    <article className={CLS.paper} style={{ boxShadow: SHADOW.paper }}>
      {band && <div aria-hidden className={CLS.band} />}
      {children}
    </article>
  )
}

// 날짜·금액 한 덩어리 안에서는 줄을 바꾸지 않고, sep(' ~ ', ' · ') 뒤에서만 바꾼다(띄어쓰기를 nbsp로).
const keep = (value: string, sep = '') =>
  (sep ? value.split(sep) : [value]).map(part => part.replaceAll(' ', ' ')).join(sep)

// 머리 정보 한 줄: '마감 …'만 조금 진하게, 나머지는 회색. 줄을 쌓지 않고 가운뎃점으로 이어 흘린다.
function InfoLine({ data }: { data: FormSample }) {
  const { text } = data
  const items: ReactNode[] = [
    text.deadline && (
      <span key="deadline" className="font-medium text-fg-secondary">
        {keep(`마감 ${text.deadline.replace(/까지$/, '')}`)}
      </span>
    ),
    <span key="when">{keep(text.when, ' ~ ')}</span>,
    <span key="place">{keep(text.place ?? '장소 미정')}</span>,
    <span key="fee">{keep(`참가비 ${text.fee}`, ' · ')}</span>,
  ].filter(Boolean)
  return (
    <p className="mt-2 text-sm leading-6 break-keep text-fg-tertiary wrap-anywhere">
      {items.map((item, at) => (
        <span key={at}>
          {at > 0 && (
            <span aria-hidden className="text-fg-subtle">
              {' · '}
            </span>
          )}
          {item}
        </span>
      ))}
    </p>
  )
}

// 머리: 작은 학생회 이름 → 행사명(굵게 20px) → 회색 한 줄 → 운영진 안내(있을 때만). 아래 가는 선 하나로 칸과 나눈다.
export function Head({ data }: { data: FormSample }) {
  const notice = data.form.form.notice
  return (
    <header className={`${CLS.pad} border-b border-border-default pt-5 pb-5 sm:pt-7`}>
      <p className="text-xs font-medium text-fg-muted">{data.text.council}</p>
      <h1 className="mt-1 text-xl leading-7 font-bold break-keep text-fg wrap-anywhere">
        {data.text.event}
      </h1>
      <InfoLine data={data} />
      {notice && (
        <p className="mt-3 border-l-2 border-border-strong pl-3 text-sm whitespace-pre-wrap text-fg-secondary">
          {notice}
        </p>
      )}
    </header>
  )
}

// 복사 결과 알림: 화면 아래 잠깐 뜨는 한 줄(Material snackbar). 확인 창은 쓰지 않는다.
export function useToast() {
  const [message, setMessage] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const show = (next: string) => {
    setMessage(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMessage(''), TOAST_MS)
  }
  const node = (
    <div role="status" aria-live="polite">
      {message && (
        <p className={CLS.toast} style={{ boxShadow: SHADOW.toast }}>
          {message}
        </p>
      )}
    </div>
  )
  return { show, node }
}
