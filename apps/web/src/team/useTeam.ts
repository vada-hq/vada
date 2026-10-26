import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type TeamResponse } from '@vada/contracts'
import { getJson, postJson } from '@/lib/api'
import { sameJson } from '@/lib/same-json'
import { useLatest } from '@/lib/use-latest'

// 운영진과 부서 목록(운영진 > 사람, 부서가 같이 쓴다). onForbidden은 권한이나 소속이 바뀌었을 때 학생회를 다시 읽게 한다.
export function useTeam(councilId: string, onForbidden: () => void, enabled = true) {
  const base = `/api/organizations/${encodeURIComponent(councilId)}`
  const [data, setData] = useState<TeamResponse | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const active = useRef(true)
  const forbidden = useLatest(onForbidden)
  // 개발 모드(StrictMode)는 effect를 정리했다 다시 실행한다. 다시 실행될 때 true로 돌려놓는다.
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setLoadFailed(false)
    void getJson<TeamResponse>(`${base}/members`, controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (result.ok)
        return setData(current => (sameJson(current, result.data) ? current : result.data))
      if (result.status === statusOf('FORBIDDEN')) forbidden.current()
      setLoadFailed(true)
    })
    return () => controller.abort()
  }, [base, attempt, forbidden, enabled])

  // 회장단의 변경은 목록 전체를 돌려준다. 성공하면 null을, 실패하면 오류 코드를 돌려준다.
  // 권한이 바뀌었으면(권한 오류) 학생회를 다시 읽고, 화면이 오래됐으면(권한·없음 오류) 목록도 다시 읽는다.
  async function change(path: string, body: unknown): Promise<string | null> {
    setSaving(true)
    const result = await postJson<TeamResponse>(`${base}${path}`, body)
    if (!active.current) return null
    setSaving(false)
    if (result.ok) {
      setData(current => (sameJson(current, result.data) ? current : result.data))
      return null
    }
    if (result.status === statusOf('FORBIDDEN')) forbidden.current()
    if (result.status === statusOf('FORBIDDEN') || result.status === statusOf('NOT_FOUND'))
      setAttempt(value => value + 1)
    return result.code
  }

  const reload = useCallback(() => setAttempt(value => value + 1), [])
  return { data, loadFailed, saving, change, reload }
}
export type Team = ReturnType<typeof useTeam>
