import { useEffect, useState } from 'react'
import type { MeProfileResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'

// 로그인에 이어진 운영진의 이름(GET /api/me/profile). 없으면 null이라 만들기 2단계가 '내 이름' 칸을 보인다(기능 020 정한 것 8).
// 읽기가 늦거나 실패해도 칸을 보인다. 이미 이어진 사람이 보낸 이름은 서버가 무시하므로 칸을 잘못 보여도 이름이 바뀌지 않는다.
export function useLinkedMemberName() {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void getJson<MeProfileResponse>('/api/me/profile', controller.signal).then(result => {
      if (!controller.signal.aborted && result.ok) setName(result.data.name)
    })
    return () => controller.abort()
  }, [])
  return name
}
