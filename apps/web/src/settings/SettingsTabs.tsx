import { TabButton } from '@/components/ui/tab-button'

export function SettingsTabs({
  accounts,
  onChange,
}: {
  accounts: boolean
  onChange: (accounts: boolean) => void
}) {
  return (
    <div role="tablist" aria-label="설정 보기" className="flex flex-wrap border-b">
      <TabButton
        className="max-sm:min-h-11"
        aria-selected={!accounts}
        onClick={() => onChange(false)}
      >
        학생회 정보
      </TabButton>
      <TabButton
        className="max-sm:min-h-11"
        aria-selected={accounts}
        onClick={() => onChange(true)}
      >
        계좌
      </TabButton>
    </div>
  )
}
