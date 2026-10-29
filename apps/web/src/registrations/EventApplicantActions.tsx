import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { ApplicantChange, EventApplicant } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuLabel, MenuTrigger } from '@/components/ui/menu'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { ApplicantActions } from './ApplicantActions'
import { DepositActions } from './DepositActions'
import { eventApplicantActions } from '@/lib/registration-messages'

type Props = EventDialogHandlers & {
  councilId: string
  applicant: EventApplicant
  onChange: (change: ApplicantChange) => void
  onGone: () => void
}

// 긴 이름의 전체 보기와 기존 단건 동작을 한 곳에 둔다. 확인 창이 열려도 메뉴를 유지해 기존 상태를 보존한다.
export function EventApplicantActions(props: Props) {
  const [open, setOpen] = useState(false)
  const { applicant } = props
  const changed = (change: ApplicantChange) => {
    props.onChange(change)
    setOpen(false)
  }
  return (
    <Menu open={open} onOpenChange={setOpen} modal={false}>
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          touch
          aria-label={eventApplicantActions(applicant.name)}
          className="size-8 rounded-lg p-0 text-fg-muted pointer-coarse:size-11"
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </Button>
      </MenuTrigger>
      <MenuContent
        onInteractOutside={event => {
          if (document.querySelector('[role="dialog"]')) event.preventDefault()
        }}
        onFocusOutside={event => {
          if (document.querySelector('[role="dialog"]')) event.preventDefault()
        }}
      >
        <MenuLabel className="wrap-anywhere">{applicant.name}</MenuLabel>
        <ApplicantActions {...props} menu onChange={changed} />
        <DepositActions {...props} menu touch onChange={changed} />
      </MenuContent>
    </Menu>
  )
}
