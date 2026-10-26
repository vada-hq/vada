import { useEffect, useRef, useState } from 'react'
import {
  defaultDepartmentColor,
  UpdateDepartmentColorSchema,
  type DepartmentColorKey,
  type TeamDepartment,
} from '@vada/contracts'
import { NOT_FOUND_RELOADED, PERMISSION_CHANGED } from '@/lib/messages'
import type { Team } from './useTeam'
import { isFinal, type useDepartmentRequests } from './useDepartmentRequests'
import type { useMenuFocus } from './use-menu-focus'

export function useDepartmentColor(
  manage: boolean,
  team: Team,
  requests: ReturnType<typeof useDepartmentRequests>,
  focus: ReturnType<typeof useMenuFocus>,
) {
  const [id, setId] = useState<string | null>(null)
  const [color, setColor] = useState<DepartmentColorKey>('teal')
  const sending = useRef(false)
  const department = manage ? (team.data?.departments.find(item => item.id === id) ?? null) : null
  useEffect(() => {
    if (!id || !team.data || department) return
    setId(null)
    requests.report(manage ? NOT_FOUND_RELOADED : PERMISSION_CHANGED)
  }, [id, team.data, department, manage, requests])
  async function save() {
    const parsed = UpdateDepartmentColorSchema.safeParse({ color })
    if (!department || !parsed.success || team.saving || sending.current) return
    sending.current = true
    try {
      const code = await requests.run(
        `/departments/${encodeURIComponent(department.id)}/color`,
        parsed.data,
        'color',
      )
      if (code === null || isFinal(code)) setId(null)
    } finally {
      sending.current = false
    }
  }
  return {
    department,
    color,
    setColor,
    save,
    open: (item: TeamDepartment) => {
      requests.clear()
      focus.remember(item.id)
      setColor(item.color ?? defaultDepartmentColor(item.id))
      setId(item.id)
    },
    close: () => {
      if (!team.saving) {
        setId(null)
        requests.clear()
      }
    },
  }
}
