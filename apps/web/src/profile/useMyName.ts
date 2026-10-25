import { useEffect, useState } from 'react'
import { readMyName } from '@/lib/my-name'

// 로그인에 이어진 운영진의 이름. 읽기 전과 읽지 못했을 때는 null이라 '내 이름' 칸을 보인다(readMyName).
export function useMyName() {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void readMyName(controller.signal).then(next => {
      if (!controller.signal.aborted) setName(next)
    })
    return () => controller.abort()
  }, [])
  return name
}
