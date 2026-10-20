import { useEffect, useState } from 'react'
import { statusOf, type InviteCodeResponse } from '@vada/contracts'
import { getJson, postJson } from '@/lib/api'
import type { INVITE_LOAD_ERRORS } from '@/lib/messages'
import { useLatest } from '@/lib/use-latest'

export type Notice = 'copied' | 'copy-failed' | 'rotated' | 'failed' | 'forbidden' | null

// 초대 링크의 코드와 동작: 불러오기, 링크 복사, 코드 바꾸기. 권한 오류면 권한이 바뀐 것이라 onForbidden으로
// 학생회를 다시 읽게 한다. 불러오기가 실패하면 retry로 다시 시도할 수 있다.
export function useInvite(councilId: string, onForbidden: () => void) {
  const base = `/api/organizations/${encodeURIComponent(councilId)}/invite`
  const [code, setCode] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<keyof typeof INVITE_LOAD_ERRORS | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [rotating, setRotating] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const forbidden = useLatest(onForbidden)
  useEffect(() => {
    const controller = new AbortController()
    setLoadError(null)
    void getJson<InviteCodeResponse>(base, controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (result.ok) return setCode(result.data.code)
      if (result.status === statusOf('FORBIDDEN')) forbidden.current()
      setLoadError(result.status === statusOf('FORBIDDEN') ? 'forbidden' : 'failed')
    })
    return () => controller.abort()
  }, [base, attempt, forbidden])

  async function copy(link: string) {
    try {
      // HTTP 접속이나 오래된 브라우저에는 클립보드 API가 없다.
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(link)
      setNotice('copied')
    } catch {
      setNotice('copy-failed')
    }
  }
  async function rotate() {
    setRotating(true)
    setNotice(null)
    const result = await postJson<InviteCodeResponse>(`${base}/rotate`, {})
    setRotating(false)
    if (!result.ok) {
      if (result.status === statusOf('FORBIDDEN')) forbidden.current()
      return setNotice(result.status === statusOf('FORBIDDEN') ? 'forbidden' : 'failed')
    }
    setCode(result.data.code)
    setNotice('rotated')
  }
  return {
    code,
    loadError,
    rotating,
    notice,
    copy,
    rotate,
    retry: () => setAttempt(value => value + 1),
  }
}
