import { useEffect, useRef, useState } from 'react'
import { menuPath, PURCHASE_TITLE_MAX, type PurchaseRequestDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { useUnsavedInput } from '@/lib/leave-guard'
import { requiredText, useFormCheck, withContract } from '@/lib/use-form-check'
import type { Choice } from '@/tasks/task-form-options'
import type { PurchaseDialogHandlers } from './purchase-requests'
import {
  emptyRequest,
  restoredRequest,
  requestOf,
  type RequestStart,
  type RequestValues,
} from './request-form'
import { RequestItemList } from './RequestItemList'
import { useRequestCreate } from './useRequestCreate'
import { useRequestValues } from './use-request-values'
import { useRequestProductSeeds } from './use-request-product-seeds'
import { navigate } from '@/lib/app-location'
import { purchaseDraftOf, savePurchaseDraft, type PurchaseDraft } from './purchase-draft'
import { RequestSummary } from './RequestSummary'
import { RequestBasics } from './RequestBasics'
import { PurchaseColumns } from './PurchaseColumns'
import { clipText } from '@/chat/request-seed'
import PageHeading from '@/components/PageHeading'

type RequestCreateProps = Pick<PurchaseDialogHandlers, 'onLost' | 'onForbidden'> & {
  councilId: string
  memberId: string
  // 행사 화면에서 열면 그 행사로 채운다.
  eventId?: string | null
  // 대화의 메시지에서 열면 그 메시지로 채운 값(제목, 내용, 요청한 사람, 근거 메시지).
  start?: RequestStart
  // 업무 상세에서 열면 그 업무(기능 015). 낸 요청이 업무에 이어진다.
  taskId?: string
  // 대화에서 열면 내 업무 가운데 하나를 고르는 칸을 둔다.
  pickTask?: boolean
  // 재정부가 대신 낼 때 고르는 요청한 사람들. 없으면 칸이 없다.
  requesters?: Choice[] | null
  // 열림 상태는 부모가 가진다([구매 요청 내기] 버튼이 연다).
  open: boolean
  onClose: () => void
  // 낸 요청을 받는다. 부모가 목록을 다시 읽고 대화상자를 닫는다.
  onCreated: (request: PurchaseRequestDetail) => void
}
type Props = RequestCreateProps

// 기존 진입점은 팝업을 그리지 않고 같은 작성 주소로 옮긴다.
export function RequestCreateDialog({ open, ...props }: Props) {
  if (!open) return null
  return <CreateEntry {...props} />
}

function CreateEntry(props: Omit<Props, 'open'>) {
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    navigate(menuPath('purchases', props.councilId, { compose: 'new' }), {
      overRecord: true,
      pageState: {
        kind: 'purchase',
        councilId: props.councilId,
        memberId: props.memberId,
        eventId: props.eventId,
        taskId: props.taskId,
        pickTask: props.pickTask,
        start: props.start,
      },
    })
  }, [props])
  return null
}

const DIGITS = /^[0-9]+$/

// 제목과 품목마다 이름·수량이 필수다. 수량은 1 이상의 정수(계약과 같은 규칙).
function requestErrors(values: RequestValues) {
  const items = values.items.flatMap((item, index) => {
    const quantity = item.quantity.trim()
    return [
      [`items.${index}.name`, requiredText(item.name, '이름을')],
      [
        `items.${index}.quantity`,
        requiredText(quantity, '수량을') ??
          (DIGITS.test(quantity) && Number(quantity) > 0
            ? undefined
            : '1 이상의 숫자를 입력해 주세요'),
      ],
    ] as const
  })
  return { title: requiredText(values.title, '제목을'), ...Object.fromEntries(items) }
}

// 한 줄의 문제만 골라 그 줄에 넘긴다.
// 계약이 막은 형식 문제 가운데 칸 이름만으로는 알기 어려운 것
const CONTRACT_MESSAGES = { link: 'http:// 또는 https://로 시작하는 주소를 입력해 주세요' }

type FormProps = Omit<Props, 'open'> & { saving: boolean; setSaving: (saving: boolean) => void }

// 오류와 [취소]·[내기]
function CreateFooter(props: { problem: string | null; saving: boolean; onClose: () => void }) {
  return (
    <>
      {props.problem && <StateMessage kind="error">{props.problem}</StateMessage>}
      <DialogFooter>
        <Button type="button" variant="outline" busy={props.saving} onClick={props.onClose}>
          취소
        </Button>
        <Button type="submit" busy={props.saving}>
          내기
        </Button>
      </DialogFooter>
    </>
  )
}

function CreateForm({
  saving,
  setSaving,
  eventId,
  start,
  requesters,
  taskId,
  pickTask = false,
  ...props
}: FormProps) {
  const [initial] = useState(() => emptyRequest(eventId ?? null, start))
  const [draft] = useState<PurchaseDraft>(
    () =>
      purchaseDraftOf(props.councilId, props.memberId) ?? {
        kind: 'purchase',
        councilId: props.councilId,
        memberId: props.memberId,
        ...(eventId !== undefined ? { eventId } : {}),
        ...(start ? { start } : {}),
        ...(taskId ? { taskId } : {}),
        pickTask,
      },
  )
  const [restored] = useState(() => (draft.values ? restoredRequest(draft.values) : initial))
  const { values, picked, setValues, setPicked, autoChange, dirty } = useRequestValues(() => ({
    values: { request: restored, picked: draft.picked ?? null },
    baseline: { request: initial, picked: null },
  }))
  // 메시지의 링크로 채운 상품 정보는 화면이 채운 것이라, 사람이 손대기 전이면 떠날 때 묻는 기준에 넣는다.
  useRequestProductSeeds(props.councilId, restored, autoChange)
  // 쓰던 입력이 남았으면 새로고침이나 다른 곳으로 떠날 때 묻는다(떠날 때 확인).
  useUnsavedInput(dirty)
  useEffect(() => {
    savePurchaseDraft(draft, values, picked)
  }, [draft, values, picked])
  const linked = taskId ?? picked?.id
  const request = { ...requestOf(values), ...(linked ? { taskId: linked } : {}) }
  const create = useRequestCreate(props.councilId, request, { ...props, setSaving })
  const set = (patch: Partial<typeof values>) => setValues({ ...values, ...patch })
  const {
    formRef,
    errors: fieldErrors,
    attempt,
  } = useFormCheck(() => withContract(requestErrors(values), create.parsed, CONTRACT_MESSAGES))
  return (
    <form
      ref={formRef}
      noValidate
      aria-label="구매 요청 내기"
      className="flex flex-col gap-6"
      onSubmit={event => {
        event.preventDefault()
        if (attempt()) void create.submit()
      }}
    >
      <PurchaseColumns
        summary={
          <>
            <RequestSummary values={values} />
            <CreateFooter problem={create.problem} saving={saving} onClose={props.onClose} />
          </>
        }
      >
        <RequestBasics
          councilId={props.councilId}
          values={values}
          saving={saving}
          errors={fieldErrors}
          requesters={requesters}
          pickTask={pickTask}
          picked={picked}
          onChange={set}
          onPick={setPicked}
          onForbidden={props.onForbidden}
        />
        <section aria-label="요청 품목" className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">요청 품목</h2>
          <RequestItemList
            councilId={props.councilId}
            items={values.items}
            disabled={saving}
            errors={fieldErrors}
            onChange={items => {
              const loaded = items.find(
                item =>
                  item.loadedProduct &&
                  (values.title.trim() === '' || values.title.trim() === item.link),
              )
              set({
                items,
                ...(!values.titleEdited && loaded?.loadedProduct
                  ? { title: clipText(loaded.loadedProduct.name, PURCHASE_TITLE_MAX) }
                  : {}),
              })
            }}
          />
        </section>
      </PurchaseColumns>
    </form>
  )
}

export function RequestCreatePage(props: Omit<Props, 'open'>) {
  const [saving, setSaving] = useState(false)
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        trail={{
          title: '구매 요청 내기',
          crumbs: [
            { label: '구매 요청', truncate: false },
            { label: '새 요청', truncate: false },
          ],
        }}
      >
        <h1 className="text-xl font-semibold">구매 요청 내기</h1>
      </PageHeading>
      <CreateForm {...props} saving={saving} setSaving={setSaving} />
    </div>
  )
}
