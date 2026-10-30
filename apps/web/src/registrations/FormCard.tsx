import { useRef, useState } from 'react'
import {
  AlignLeft,
  CalendarDays,
  Clock,
  Eye,
  Landmark,
  ListChecks,
  MoreHorizontal,
  Pencil,
  UserRound,
  Wallet,
} from 'lucide-react'
import type { EventDetail, RegistrationForm } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import type { EventFieldFocus } from '@/events/EventFields'
import { whenLabel } from '@/events/event-view'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { feeText } from '@/public/registration-text'
import { PageIcon, PropRow, TextAction } from './DocParts'
import { sheet, size, type } from './doc-look'
import { cardTone, chargesFee } from './form-card-text'
import { FormCardBand } from './FormCardBand'
import { CollectedValue, Missing } from './FormCardValues'
import { PreviewDialog } from './FormPreview'
import { previewOf, valuesOfForm } from './registration-form'
import { periodRow } from './registration-view'
import { useFormCardActions, type EditorFocus, type FormCardActions } from './useFormCardActions'

type Props = EventDialogHandlers & {
  councilId: string
  councilName: string
  // 행사 일시 줄과 미리보기에 쓴다. 읽기 전이면 null이다.
  event: EventDetail | null
  form: RegistrationForm
  onEdit: (focus?: EditorFocus) => void
  onEditEvent: (focus: EventFieldFocus) => void
  onChanged: () => void
}

// 양식 카드 = 앱 바탕 위 문서 한 장(대표 확정 시안 '문서 한 장 모양' refined). 위에서부터 머리(이름·[미리보기]·[고치기]·•••),
// 머리 띠(상태·큰 수·링크와 QR 또는 [신청 양식 활성화]), 설정 속성 줄. 빠진 조건은 그 줄의 값 자리에 '비어 있음 · 채우기'.
// 버튼은 서버가 준 actions로만 보이거나 숨는다(DEC-38). 읽기는 가리지 않는다.

function Head({
  form,
  actions,
  onPreview,
  onEdit,
}: {
  form: RegistrationForm
  actions: FormCardActions
  onPreview: (() => void) | null
  onEdit: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <PageIcon />
      <h3 className={`min-w-0 flex-1 ${type.cardTitle} text-fg wrap-anywhere`}>{form.name}</h3>
      <div className="flex items-center max-sm:-ml-2 max-sm:w-full sm:-mr-2">
        {onPreview && (
          <TextAction icon={Eye} onClick={onPreview}>
            미리보기
          </TextAction>
        )}
        {form.actions.includes('form.update') && (
          <TextAction icon={Pencil} onClick={onEdit}>
            고치기
          </TextAction>
        )}
        {form.actions.includes('form.pause') && (
          <Menu>
            <MenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="양식 더보기"
                className={`${size.iconHit} rounded-lg`}
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={actions.pause}>멈추기</MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>
    </div>
  )
}

type RowsProps = Pick<Props, 'form' | 'event'> & { actions: FormCardActions; draft: boolean }

// 행사 일시는 초안에서만 보인다(받는 중 이후 카드는 행사 화면 안이라 반복).
function EventRow({ event, actions }: Pick<RowsProps, 'event' | 'actions'>) {
  if (!event && !actions.missing.includes('event_starts_at')) return null
  return (
    <PropRow icon={CalendarDays} label="행사 일시">
      {actions.missing.includes('event_starts_at') || !event ? (
        <Missing label="행사 시작 일시" onFill={actions.fills.event_starts_at} />
      ) : (
        <span className="text-fg-secondary wrap-anywhere">
          {whenLabel(event)} · {event.place ?? '장소 미정'}
        </span>
      )}
    </PropRow>
  )
}

function DeadlineValue({ form, actions }: Pick<RowsProps, 'form' | 'actions'>) {
  if (actions.missing.includes('closes_at'))
    return <Missing label="신청 마감" onFill={actions.fills.closes_at} />
  return (
    <span className="flex flex-wrap items-center gap-x-2">
      {periodRow(form).value}
      {actions.missing.includes('registration_period') && (
        <>
          <span className="text-danger">신청 시작보다 이름</span>
          {actions.fills.registration_period && (
            <TextAction strong data-fill onClick={actions.fills.registration_period}>
              고치기
            </TextAction>
          )}
        </>
      )}
    </span>
  )
}

function SettingRows({ form, event, actions, draft }: RowsProps) {
  return (
    <div className="flex flex-col gap-1 sm:gap-0">
      {draft && <EventRow event={event} actions={actions} />}
      {/* 마감이 비면 채울 값이 마감이라 라벨도 '신청 마감'이다. */}
      <PropRow
        icon={Clock}
        label={actions.missing.includes('closes_at') ? '신청 마감' : periodRow(form).label}
      >
        <DeadlineValue form={form} actions={actions} />
      </PropRow>
      <PropRow icon={Wallet} label="참가비">
        {feeText(form)}
      </PropRow>
      {chargesFee(form) && (
        <PropRow icon={Landmark} label="참가비 받을 계좌">
          {actions.missing.includes('fee_account') || !form.feeAccount ? (
            <Missing label="참가비 받을 계좌" onFill={actions.fills.fee_account} />
          ) : (
            <span className="wrap-anywhere">{form.feeAccount.name}</span>
          )}
        </PropRow>
      )}
      <PropRow icon={UserRound} label="정원">
        {form.capacity === null ? '제한 없음' : `${form.capacity.toLocaleString()}명`}
      </PropRow>
      <PropRow icon={ListChecks} label="받는 항목">
        <CollectedValue form={form} />
      </PropRow>
      {/* 안내는 미리보기에도 있지만 미리보기는 inert라 화면 읽기가 못 읽고, 행사를 못 읽으면 미리보기 자체가 없다. 카드에서도 읽게 둔다. */}
      {form.notice && (
        <PropRow icon={AlignLeft} label="안내">
          <span className="line-clamp-3 whitespace-pre-line wrap-anywhere">{form.notice}</span>
        </PropRow>
      )}
    </div>
  )
}

export function FormCard(props: Props) {
  const { form, event, councilName } = props
  const actions = useFormCardActions(props)
  const [previewing, setPreviewing] = useState(false)
  const article = useRef<HTMLElement>(null)
  const tone = cardTone(form)
  return (
    <article
      ref={article}
      aria-label={form.name}
      className={`flex w-full min-w-0 flex-col gap-5 px-4 py-5 break-keep sm:px-8 sm:py-7 ${sheet}`}
    >
      <Head
        form={form}
        actions={actions}
        onPreview={event ? () => setPreviewing(true) : null}
        onEdit={() => props.onEdit()}
      />
      <FormCardBand form={form} tone={tone} actions={actions} sheet={article} />
      {actions.post.problem && <StateMessage kind="error">{actions.post.problem}</StateMessage>}
      <SettingRows form={form} event={event} actions={actions} draft={tone === 'draft'} />
      {event && (
        <PreviewDialog
          data={previewOf(valuesOfForm(form), event, councilName)}
          open={previewing}
          onOpenChange={setPreviewing}
        />
      )}
    </article>
  )
}
