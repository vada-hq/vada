import { useEffect, useState } from 'react'
import type { PublicRegistrationForm } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { savedCodeOf } from './saved-links'

// 내 신청 응답에는 행사 일시·장소·지우는 날이 없다. 같은 기기에서 신청했으면 기억한 코드로 공개 양식을 한 번 읽어
// 행사 정보와 당일(입장 QR 맨 위)을 정한다. 코드를 모르거나 읽지 못하면 null이고, 화면은 그것들 없이 보인다.
export function useMineForm(token: string) {
  const [form, setForm] = useState<PublicRegistrationForm | null>(null)
  useEffect(() => {
    const code = savedCodeOf(token)
    if (code === null) return
    const controller = new AbortController()
    void getJson<PublicRegistrationForm>(
      `/api/public/registration-forms/${encodeURIComponent(code)}`,
      controller.signal,
    ).then(result => {
      if (result.ok) setForm(result.data)
    })
    return () => controller.abort()
  }, [token])
  return form
}
