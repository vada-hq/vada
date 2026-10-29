import type { PublicRegistrationForm } from '@vada/contracts'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ApplyFields from '@/public/ApplyFields'
import FormSummary from '@/public/FormSummary'
import { EMPTY_VALUES } from '@/public/useApply'
import { type } from './doc-look'

const ignore = () => {}

// 학생이 링크를 열면 보는 화면. 공개 신청 화면의 부품(확정안 '큰 글자 앱 화면 모양')을 그대로 써서 모양이 어긋나지 않는다.
// 누르거나 읽히지 않게 inert로 막는다(미리보기라 신청되지 않는다). 여백은 공개 화면 틀(PublicApp)과 같다.
function StudentScreen({ data }: { data: PublicRegistrationForm }) {
  return (
    <div inert className="flex flex-col bg-white px-6 pt-8 break-keep text-fg">
      <FormSummary data={data} />
      <ApplyFields
        data={data}
        values={EMPTY_VALUES}
        busy={false}
        problem=""
        onValues={ignore}
        onSubmit={ignore}
        preview
      />
    </div>
  )
}

// 편집기 옆 미리보기: 휴대폰 폭(390px) 그대로 그려 학생이 보는 줄바꿈이 같다. 틀 안에서만 스크롤한다.
export function PhonePreview({ data }: { data: PublicRegistrationForm }) {
  return (
    <section aria-label="미리보기" className="flex flex-col items-center gap-2">
      <div className="w-97.5 overflow-hidden rounded-tray bg-white ring-8 ring-surface-muted outline outline-border-default">
        <div className="h-160 overflow-y-auto overscroll-contain">
          <StudentScreen data={data} />
        </div>
      </div>
      <p className={`${type.small} text-fg-muted`}>학생 화면</p>
    </section>
  )
}

// 카드의 [미리보기]와 좁은 편집기의 [미리보기]: 창 안에 같은 학생 화면을 실제 크기로.
export function PreviewDialog({
  data,
  open,
  onOpenChange,
}: {
  data: PublicRegistrationForm
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="gap-2 px-0 pb-0 sm:max-w-107.5">
        <DialogHeader className="px-6">
          <DialogTitle>학생 화면 미리보기</DialogTitle>
        </DialogHeader>
        <StudentScreen data={data} />
      </DialogContent>
    </Dialog>
  )
}
