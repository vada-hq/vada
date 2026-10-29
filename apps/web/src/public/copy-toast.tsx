import { useCallback, useEffect, useRef, useState } from 'react'
import { copyText } from '@/lib/copy-text'
import { type } from './public-look'

const TOAST_MS = 2400

export type CopyTarget = 'account' | 'link'

// 복사하고 성공은 화면 아래 토스트로 잠깐 알린다(M3 snackbar). 앱 안 브라우저에서 막히면 무엇이 막혔는지 돌려주어
// 그 자리에 값을 보여 길게 눌러 복사하게 한다(CopyButton과 같은 뜻).
export function useCopy() {
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState<CopyTarget | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = useCallback((what: CopyTarget, value: string, done: string) => {
    void copyText(value).then(ok => {
      setFailed(ok ? null : what)
      if (!ok) return
      clearTimeout(timer.current)
      setMessage(done)
      timer.current = setTimeout(() => setMessage(''), TOAST_MS)
    })
  }, [])
  return { copy, message, failed }
}

export type Copy = ReturnType<typeof useCopy>

export function CopyFailed({ value }: { value: string }) {
  return (
    <p role="status" className={`${type.label} text-fg-muted wrap-anywhere`}>
      복사하지 못했어요. 길게 눌러 복사해 주세요.{' '}
      <span className="text-fg select-all">{value}</span>
    </p>
  )
}

export function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-6"
    >
      {message && (
        <p
          className={`rounded-2xl bg-surface-inverse px-5 py-3 ${type.label} font-medium text-white shadow-lg`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
