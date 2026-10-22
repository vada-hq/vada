import { useState } from 'react'
import { statusOf, type PublicRegistrationForm } from '@vada/contracts'
import { usePolledRead } from '@/lib/use-polled-read'
import { useReloadAt } from './useReloadAt'

// 공개 양식 읽기. 남은 자리와 상태가 바뀌므로 보이는 동안 다시 읽고, 시작 시각이 되면 바로 한 번 더 읽어 칸을 연다.
export function usePublicForm(code: string) {
  const [lost, setLost] = useState(false)
  const { state, reload } = usePolledRead<PublicRegistrationForm>(
    `/api/public/registration-forms/${encodeURIComponent(code)}`,
    status => {
      if (status === statusOf('NOT_FOUND')) setLost(true)
    },
  )
  const data = state.kind === 'ready' ? state.data : null
  useReloadAt(data?.status === 'before_open' ? data.form.opensAt : null, () => void reload(), data)
  return { state, lost, reload: () => void reload() }
}
