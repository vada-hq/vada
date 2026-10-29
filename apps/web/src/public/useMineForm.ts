import { useCallback, useEffect, useRef, useState } from 'react'
import type { PublicRegistrationForm } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { LIST_POLL_MS, useVisiblePoll } from '@/lib/use-visible-poll'
import { savedCodeOf } from './saved-links'

// 내 신청 응답에는 행사 일시·장소·지우는 날이 없다. 같은 기기에서 신청했으면 기억한 코드로 공개 양식을 읽어
// 행사 정보와 당일(입장 QR 맨 위)을 정한다. 코드를 모르거나 읽지 못하면 null이고, 화면은 그것들 없이 보인다.
// 운영진이 일시·장소를 바꿀 수 있어 내 신청과 같이 보이는 동안 다시 읽는다. 다시 읽다 실패하면 보이던 값을 둔다.
export function useMineForm(token: string) {
  const [form, setForm] = useState<PublicRegistrationForm | null>(null)
  const turn = useRef(0)
  const load = useCallback(async () => {
    const code = savedCodeOf(token)
    if (code === null) return
    const mine = ++turn.current
    const result = await getJson<PublicRegistrationForm>(
      `/api/public/registration-forms/${encodeURIComponent(code)}`,
    )
    if (mine === turn.current && result.ok) setForm(result.data)
  }, [token])
  useEffect(() => {
    const turns = turn
    void load()
    // 화면을 떠나거나 토큰이 바뀌면 늦게 온 응답을 버린다.
    return () => void turns.current++
  }, [load])
  useVisiblePoll(() => void load(), LIST_POLL_MS)
  return form
}
