import type { PublicRegistrationForm } from '@vada/contracts'
import { useId } from 'react'
import ApplyFields from '@/public/ApplyFields'
import FormSummary from '@/public/FormSummary'
import { EMPTY_VALUES } from '@/public/useApply'

const ignore = () => {}

// 학생이 링크를 열면 보는 화면. 공개 신청 화면의 부품을 그대로 써서 모양이 어긋나지 않는다.
// 누르거나 읽히지 않게 inert로 막는다(미리보기라 신청되지 않는다). 와이어프레임 EVT-05의 '미리보기'.
export function FormPreview({
  data,
  showTitle = true,
}: {
  data: PublicRegistrationForm
  showTitle?: boolean
}) {
  const titleId = useId()
  return (
    <section
      aria-label={showTitle ? undefined : '학생 신청 화면'}
      aria-labelledby={showTitle ? titleId : undefined}
      className="flex flex-col gap-2"
    >
      {showTitle && (
        <h3 id={titleId} className="text-sm font-semibold text-fg">
          미리보기
        </h3>
      )}
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
