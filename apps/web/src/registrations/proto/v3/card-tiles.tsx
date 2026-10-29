import { Download, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CardForm } from '../builder-data'
import type { BuilderProps } from '../builder-props'
import { QrImage, StateMark } from './parts'

// 양식 카드 오른쪽 칸: 링크가 있으면 흰 QR 타일, 초안이면 점선 빈 칸 안 '열기 전 채울 것'.

export type Phase = 'draft' | 'active' | 'paused' | 'ended'

// 오른쪽 칸(링크가 있을 때): 흰 QR 타일. 멈춤·종료는 옅은 덮개 + 글자.
export function QrTile({
  item,
  phase,
  props,
}: {
  item: CardForm
  phase: Phase
  props: BuilderProps
}) {
  const link = item.text.link!
  const cover = { paused: '신청 멈춤', ended: '신청 종료' }[phase as 'paused' | 'ended']
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="self-start text-xs font-medium text-fg-tertiary">포스터용 QR</p>
      <div className="relative rounded-lg border border-default bg-white p-2">
        <QrImage text={link} label={`${item.text.name} 신청 링크 QR`} />
        {cover && (
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center rounded-lg',
              phase === 'ended' ? 'bg-white/75' : 'bg-white/60',
            )}
          >
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-fg-secondary shadow-sm">
              {cover}
            </span>
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        touch
        className="text-fg-secondary"
        onClick={() => props.onSaveQr(item.form.id)}
      >
        <Download aria-hidden />
        QR 저장
      </Button>
    </div>
  )
}

// 오른쪽 칸(초안): QR이 아직 없다는 것을 점선 빈 칸으로 말하고, 그 안에 빠진 조건만 둔다.
export function MissingTile({ item, props }: { item: CardForm; props: BuilderProps }) {
  const missing = item.conditions.filter(condition => !condition.done)
  const doneCount = item.conditions.length - missing.length
  const fill = (key: CardForm['conditions'][number]['key']) => {
    if (key === 'event_starts_at') props.onEditEvent('startsAt')
    else props.onFill(item.form.id, key)
  }
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border-2 border-dashed border-border-strong p-3">
      {missing.length === 0 ? (
        <div className="flex grow flex-col items-center justify-center gap-2 py-4 text-center">
          <QrCode aria-hidden className="size-8 text-fg-faint" />
          <p className="flex items-center gap-2 text-sm font-medium text-fg-secondary">
            <StateMark done label="끝남" />
            조건 {item.conditions.length}개 모두 완료
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-fg-secondary">열기 전 채울 것</p>
          <ul className="flex flex-col gap-1">
            {missing.map(condition => (
              <li key={condition.key} className="flex items-center gap-2">
                <StateMark done={false} label="빠짐" />
                <span className="min-w-0 grow text-sm text-fg">{condition.label}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  touch
                  className="-mr-2 text-primary-strong"
                  data-fill={condition.key}
                  onClick={() => fill(condition.key)}
                >
                  채우기 ›
                </Button>
              </li>
            ))}
          </ul>
          {doneCount > 0 && (
            <p className="mt-auto flex items-center gap-2 text-xs text-fg-tertiary">
              <StateMark done label="끝남" />그 밖 {doneCount}개 완료
            </p>
          )}
        </>
      )}
    </div>
  )
}
