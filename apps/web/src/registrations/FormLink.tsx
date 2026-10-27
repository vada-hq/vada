import type { RegistrationForm } from '@vada/contracts'
import { Fact } from '@/components/Fact'
import QrCode from '@/components/QrCode'
import CopyButton from '@/public/CopyButton'
import { applyUrl } from './registration-view'

// 양식 하나의 공개 링크 복사, 포스터에 붙일 QR. 링크는 만들 때 정해져 바뀌지 않는다.
export function FormLink({ form }: { form: RegistrationForm }) {
  const url = applyUrl(form.publicCode)
  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-3">
        <Fact label="공개 링크">{url}</Fact>
      </dl>
      <CopyButton value={url} label="링크 복사" failedHint="길게 눌러 복사하세요." />
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-gray-500">포스터용 QR</p>
        <QrCode text={url} label={`${form.name} 신청 링크 QR`} />
      </div>
    </div>
  )
}
