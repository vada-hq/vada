// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(v1~v3)은 읽기만 한다(가져다 쓰기만). 고치려면 진행 에이전트에게 말한다.
// ─────────────────────────────────────────────────────────────────────────────
import type { EventDetail, PublicRegistrationForm } from '@vada/contracts'
import { momentLabel, whenLabel } from '@/events/event-view'
import { FORM_DATA, type FormSample, type FormText } from '@/public/proto/form-data'
import ApplyScreen from '@/public/proto/v2/apply'
import {
  collectedItems,
  dateText,
  feeText,
  inquiryText,
  noticePurpose,
} from '@/public/registration-text'
import { EMPTY_VALUES } from '@/public/useApply'
import { previewOf, type FormValues } from '../registration-form'

// 편집기 미리보기: 신청자 화면 확정안('큰 글자 앱 화면 모양', src/public/proto/v2)의 신청 화면을 그대로 그린다.
// 칸 값이 바뀔 때마다 지금 구현의 previewOf로 공개 양식 모양을 만들어 넣는다(받는 중으로 본다).
// 누르거나 읽히지 않게 inert로 막는다. 틀(휴대폰 틀, 높이, 스크롤)은 안이 정한다.
// v2 신청 화면은 바깥에 min-h-dvh·흰 바탕·가운데 520px 단을 두고, 640px 이상 창에서는 아래 버튼 고정을 푼다.

const ignore = () => {}

// 고지 글. 앞 회차 form-data.ts의 조립과 같다(ApplyFields Notice와 같은 문구). 마감·지우는 날이 비면 그 부분만 빈다.
function noticeText(form: PublicRegistrationForm) {
  const purge = form.purgeOn ? dateText(form.purgeOn) : ''
  return (
    `받는 곳: ${form.councilName} · 받는 항목: ${collectedItems(form).join(', ')} · 목적: ` +
    `${noticePurpose(form)} · 지우는 날: ${purge}. ${inquiryText(form.form.notice)}`
  )
}

function textOf(form: PublicRegistrationForm): FormText {
  return {
    ...FORM_DATA.main.text,
    council: form.councilName,
    event: form.event.name,
    deadline: form.form.closesAt ? `${momentLabel(form.form.closesAt)}까지` : null,
    when: whenLabel(form.event),
    place: form.event.place,
    fee: feeText(form),
    notice: noticeText(form),
  }
}

// 편집 중인 값 → 신청자 화면 견본(apply 화면에 쓰는 칸만 의미가 있다).
export function previewSample(
  values: FormValues,
  event: EventDetail,
  councilName: string,
): FormSample {
  const form = previewOf(values, event, councilName)
  return { ...FORM_DATA.main, form, text: textOf(form), input: EMPTY_VALUES, errors: {} }
}

export function ApplyPreview({
  values,
  event,
  councilName,
}: {
  values: FormValues
  event: EventDetail
  councilName: string
}) {
  const data = previewSample(values, event, councilName)
  return (
    <div inert aria-label="학생 신청 화면">
      <ApplyScreen
        screen="apply"
        data={data}
        values={EMPTY_VALUES}
        errors={{}}
        busy={false}
        problem=""
        onApply={ignore}
        onCancel={ignore}
        onCopy={ignore}
        onClosedAction={ignore}
      />
    </div>
  )
}
