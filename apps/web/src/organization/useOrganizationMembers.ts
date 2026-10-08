import { useEffect, useRef, useState } from 'react'
import type { OrganizationMembersResponse } from '@vada/contracts'

const isMembers = (body: unknown): body is OrganizationMembersResponse => typeof body === 'object' && body !== null
  && Array.isArray((body as OrganizationMembersResponse).members) && Array.isArray((body as OrganizationMembersResponse).departments)

// enabled가 거짓이면 불러오지 않는다. 회장단이 아니면 구성원 화면을 열 때만 불러온다.
export function useOrganizationMembers(organizationId: string, enabled: boolean) {
  const base = `/api/organizations/${encodeURIComponent(organizationId)}`
  const [data, setData] = useState<OrganizationMembersResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const active = useRef(true)
  useEffect(() => () => { active.current = false }, [])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setLoadError(false)
    async function load() {
      try {
        const response = await fetch(`${base}/members`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Members lookup failed')
        const body: unknown = await response.json()
        if (!isMembers(body)) throw new Error('Invalid response')
        if (!controller.signal.aborted) setData(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [base, enabled, attempt])

  // 회장단 전용 변경은 목록 전체를 돌려준다. 실패하면 오류 코드를, 성공하면 null을 돌려준다.
  async function mutate(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<string | null> {
    setSaving(true)
    try {
      const response = await fetch(`${base}${path}`, { method, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        // 권한이 사라졌거나 대상이 없어졌으면 화면이 오래된 것이다. 목록을 새로 불러온다.
        if (response.status === 403 || response.status === 404) setAttempt(value => value + 1)
        const code = (result as { error?: unknown } | null)?.error
        return response.status < 500 && typeof code === 'string' ? code : 'FAILED'
      }
      if (!isMembers(result)) return 'FAILED'
      if (active.current) setData(result)
      return null
    } catch {
      return 'FAILED'
    } finally {
      if (active.current) setSaving(false)
    }
  }

  return { data, loadError, saving, mutate, refresh: () => setAttempt(value => value + 1) }
}
export type OrganizationMembers = ReturnType<typeof useOrganizationMembers>
