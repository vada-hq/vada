import { Check } from 'lucide-react'

// 0건인 홈 구역: 회색 띠 한 줄(체크 원 + '○○ 없음'). 쟁반과 같은 면·모서리라 같은 구역이 줄어든 것으로 읽힌다.
export default function QuietBand({ id, children }: { id: string; children: string }) {
  return (
    <div className="@container min-w-0">
      <section
        aria-labelledby={id}
        className="flex h-14 items-center gap-3 rounded-tray bg-muted px-3"
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-fg-tertiary"
        >
          <Check className="size-4.5" strokeWidth={2.5} />
        </span>
        <h2 id={id} className="min-w-0 text-row-sub font-medium text-fg-secondary">
          {children}
        </h2>
      </section>
    </div>
  )
}
