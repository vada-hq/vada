import { useId } from 'react'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SidePanelSection } from '@/components/ui/side-panel'
import type { FieldErrors } from '@/lib/use-form-check'
import type { EventFieldValues } from './event-fields'

type Props = {
  values: EventFieldValues
  disabled: boolean
  onChange: (values: EventFieldValues) => void
  // 저장을 누른 뒤의 문제(칸 이름 → 글).
  errors?: FieldErrors | undefined
}

export type EventFieldFocus = 'startsAt' | 'place'

// 패널의 반영 힌트. 신청 화면은 일시·장소를 행사에서 그대로 읽고(public-form), 일시는 업무 달력(eventBarsOf)과 홈의 행사 줄(HomeEventRow)에도 나간다.
const WHEN_REFLECTED = '일정 및 신청 화면에 자동 반영'
const PLACE_REFLECTED = '신청 화면에 자동 반영'

// 이름 칸. 만들기는 이 칸 하나만 받고 일시·장소는 만든 뒤 상세에서 채운다.
// 만들기 대화상자가 열리는 순간에는 팀을 읽는 중이라 이름 칸이 없고 포커스가 닫기(×)에 간다. 칸이 생길 때 옮긴다(autoFocus).
export function EventNameField({
  values,
  disabled,
  onChange,
  errors = {},
  autoFocus,
}: Props & { autoFocus?: boolean }) {
  return (
    <Field label="이름" required error={errors.name}>
      <Input
        name="name"
        autoFocus={autoFocus}
        value={values.name}
        disabled={disabled}
        onChange={event => onChange({ ...values, name: event.target.value })}
      />
    </Field>
  )
}

// 라벨 줄 오른쪽의 '미정' 체크. 체크하면 그 칸을 끄고 비워 저장한다.
function TbdCheck({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <span className="flex items-center gap-1.5">
      <input
        id={id}
        type="checkbox"
        className="size-4 accent-blue-600"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
      />
      <Label htmlFor={id} className="font-normal text-gray-500">
        {label}
      </Label>
    </span>
  )
}

// 고치기 패널의 고치는 구역 셋: 행사 정보(이름), 일시, 장소(와이어프레임 EVT-02B). 장소 칸은 구역 이름과 겹치지 않게 와이어프레임의 '장소명'이다.
// 길이 상한은 계약이 판단하므로(safeParse) 여기에 적지 않는다. 계약에서 이름만 필수이고 나머지는 비울 수 있다.
export function EventEditFields({ values, disabled, onChange, errors = {} }: Props) {
  const set = (next: Partial<EventFieldValues>) => onChange({ ...values, ...next })
  return (
    <>
      <SidePanelSection title="행사 정보">
        <EventNameField values={values} disabled={disabled} onChange={onChange} errors={errors} />
      </SidePanelSection>
      <SidePanelSection title="일시" hint={WHEN_REFLECTED}>
        <Field label="시작 일시" error={errors.startsAt}>
          <Input
            name="startsAt"
            type="datetime-local"
            value={values.startsAt}
            disabled={disabled}
            onChange={event => set({ startsAt: event.target.value })}
          />
        </Field>
        <Field
          label="종료 일시"
          error={errors.endsAt}
          aside={
            <TbdCheck
              label="종료 시간 미정"
              checked={values.endTbd}
              disabled={disabled}
              onChange={endTbd => set({ endTbd })}
            />
          }
        >
          <Input
            name="endsAt"
            type="datetime-local"
            value={values.endTbd ? '' : values.endsAt}
            disabled={disabled || values.endTbd}
            onChange={event => set({ endsAt: event.target.value })}
          />
        </Field>
      </SidePanelSection>
      <SidePanelSection title="장소" hint={PLACE_REFLECTED}>
        <Field
          label="장소명"
          aside={
            <TbdCheck
              label="장소 미정"
              checked={values.placeTbd}
              disabled={disabled}
              onChange={placeTbd => set({ placeTbd })}
            />
          }
        >
          <Input
            name="place"
            value={values.placeTbd ? '' : values.place}
            disabled={disabled || values.placeTbd}
            onChange={event => set({ place: event.target.value })}
          />
        </Field>
      </SidePanelSection>
    </>
  )
}
