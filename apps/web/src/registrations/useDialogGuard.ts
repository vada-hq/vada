import { useEffect } from 'react'
import type { RegistrationAction, RegistrationForm } from '@vada/contracts'
import { PERMISSION_CHANGED, REGISTRATION_STAFF_LOST } from '@/lib/messages'
import type { TabDialog } from './TabDialogs'

type Read = { forms: RegistrationForm[]; actions: RegistrationAction[] }

// 열려 있는 동안 15초 읽기가 바꾼 값을 본다: 관리 권한이 빠졌거나 고치던 양식이 사라졌으면 창을 닫고 이유를 보인다.
// 읽기 전(null)에는 아무것도 하지 않는다.
export function useDialogGuard(
  dialog: TabDialog,
  read: Read | null,
  lost: (message: string) => void,
) {
  useEffect(() => {
    if (dialog === null || read === null) return
    if (!read.actions.includes('registration.manage')) return lost(PERMISSION_CHANGED)
    if (dialog.kind === 'edit' && !read.forms.some(form => form.id === dialog.formId))
      lost(REGISTRATION_STAFF_LOST)
  })
}
