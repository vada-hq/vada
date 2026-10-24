import type { PublicRegistrationForm } from '@vada/contracts'
import ApplyFields from '@/public/ApplyFields'
import FormSummary from '@/public/FormSummary'
import { EMPTY_VALUES } from '@/public/useApply'

const ignore = () => {}

// 학생이 링크를 열면 보는 화면. 공개 신청 화면의 부품을 그대로 써서 모양이 어긋나지 않는다.
// 누르거나 읽히지 않게 inert로 막는다(미리보기라 신청되지 않는다). 와이어프레임 EVT-05의 '미리보기'.
export function FormPreview({ data }: { data: PublicRegistrationForm }) {
  return (
    <section aria-labelledby="form-preview" className="flex flex-col gap-2">
      <h3 id="form-preview" className="text-sm font-semibold text-gray-900">
        미리보기
      </h3>
      <div inert className="flex flex-col gap-6 rounded-xl border bg-white p-4 shadow-sm">
        <FormSummary data={data} />
        <ApplyFields
          data={data}
          values={EMPTY_VALUES}
          busy={false}
          problem=""
          onValues={ignore}
          onSubmit={ignore}
          notice={false}
        />
      </div>
    </section>
  )
}
