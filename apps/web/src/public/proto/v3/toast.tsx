import { useEffect, useRef, useState } from 'react'
import { copyText } from '@/lib/copy-text'
import { cn } from '@/lib/utils'
import { type } from './tokens'

const SHOW_MS = 2200

// 복사 결과는 화면 아래 잠깐 뜨는 한 줄로 알린다(Material snackbar). 확인 창은 쓰지 않는다.
export function useCopyToast(onCopy: (what: 'account' | 'link', value: string) => void) {
  const [message, setMessage] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = (what: 'account' | 'link', value: string) => {
    onCopy(what, value)
    void copyText(value).then(ok => {
      setMessage(
        ok
          ? what === 'account'
            ? '계좌번호를 복사했어요'
            : '주소를 복사했어요'
          : '복사하지 못했어요. 길게 눌러 복사해 주세요.',
      )
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setMessage(''), SHOW_MS)
    })
  }
  const toast = (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-10 flex justify-center px-5"
    >
      {message && (
        <p
          className={cn(
            type.label,
            'rounded-full bg-surface-inverse px-4 py-3 font-medium text-white shadow-lg',
          )}
        >
          {message}
        </p>
      )}
    </div>
  )
  return { copy, toast }
}
