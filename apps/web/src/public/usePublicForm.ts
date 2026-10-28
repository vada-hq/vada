import { useState } from 'react'
import { statusOf, type PublicRegistrationForm } from '@vada/contracts'
import { usePolledRead } from '@/lib/use-polled-read'
import { useReloadAt } from './useReloadAt'

// 공개 양식 읽기. 남은 자리와 상태가 바뀌므로 보이는 동안 다시 읽고, 시작 시각이 되면 바로 한 번 더 읽어 칸을 연다.
export function usePublicForm(code: string) {
  const [lost, setLost] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [seen, setSeen] = useState<PublicRegistrationForm | null>(null)
  const { state, reload } = usePolledRead<PublicRegistrationForm>(
    `/api/public/registration-forms/${encodeURIComponent(code)}`,
    status => {
      if (status === statusOf('NOT_FOUND')) setLost(true)
      if (status === statusOf('REGISTRATION_NOT_OPEN')) setUnavailable(true)
    },
  )
  const data = state.kind === 'ready' ? state.data : null
  if (data !== seen) {
    setSeen(data)
    setUnavailable(false)
  }
  useReloadAt(data?.status === 'before_open' ? data.form.opensAt : null, () => void reload(), data)
  // 통신 실패 때 남겨 둔 직전 값도 공개가 거절되면 숨기고, 다음 성공 응답부터 다시 보인다.
  return {
    state,
    lost,
    unavailable,
    reload: () => void reload(),
  }
}
