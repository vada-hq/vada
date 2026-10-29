import { useCallback, useEffect, useRef, useState } from 'react'
import { copyText } from '@/lib/copy-text'
import { radius, shadow, type } from './tokens'

const TOAST_MS = 2400

// 화면 아래 잠깐 뜨는 한 줄(복사 결과). 확인 대화상자는 쓰지 않는다(M3 snackbar).
export function useToast() {
  const [message, setMessage] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const show = useCallback((next: string) => {
    clearTimeout(timer.current)
    setMessage(next)
    timer.current = setTimeout(() => setMessage(''), TOAST_MS)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { message, show }
}

// 복사하고 결과를 토스트로 알린다. 앱 안 브라우저에서 막히면 길게 눌러 복사하도록 말한다(지금 CopyButton과 같은 뜻).
export function useCopy(onCopy: (what: 'account' | 'link', value: string) => void) {
  const toast = useToast()
  const copy = (what: 'account' | 'link', value: string, done: string) => {
    onCopy(what, value)
    void copyText(value).then(ok =>
      toast.show(ok ? done : '복사하지 못했어요. 길게 눌러 복사해 주세요.'),
    )
  }
  return { copy, message: toast.message }
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
          className={`${radius.control} bg-surface-inverse px-5 py-3 ${type.label} font-medium text-white ${shadow.toast}`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
