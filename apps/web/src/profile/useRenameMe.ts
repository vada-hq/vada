import { useState } from 'react'
import type { MeProfileResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { SAVE_FAILED } from '@/lib/messages'

// 내 이름 고치기 요청. 이름은 운영진 하나라서 내가 든 모든 학생회에서 바뀐다(DEC-87).
export function useRenameMe(onSaved: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function save(name: string) {
    setBusy(true)
    setError(null)
    const result = await postJson<MeProfileResponse>('/api/me/profile', { name })
    setBusy(false)
    if (result.ok) onSaved()
    else setError(SAVE_FAILED)
  }
  return { busy, error, save, reset: () => setError(null) }
}
