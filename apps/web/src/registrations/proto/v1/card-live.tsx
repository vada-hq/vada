import { useState } from 'react'
import { Download, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { qrMatrix, qrPath } from '@/lib/qr-code'
import { cn } from '@/lib/utils'
import type { CardForm } from '../builder-data'
import type { BuilderProps } from '../builder-props'
import type { Tone } from './parts'
import { radius, size, space, type } from './tokens'

// 양식 카드 몸통(받는 중·멈춤·종료): 1순위 신청 수, 2순위 링크 줄 [링크 복사]와 포스터용 QR 썸네일.

type CardProps = { toast: (text: string) => void }

function Qr({
  text,
  label,
  className,
  measure,
}: {
  text: string
  label: string
  className: string
  measure?: string
}) {
  const matrix = qrMatrix(text)
  return (
    <svg
      data-measure={measure}
      role="img"
      aria-label={label}
      viewBox={`0 0 ${matrix.length} ${matrix.length}`}
      shapeRendering="crispEdges"
      className={cn('bg-white', className)}
    >
      <path d={qrPath(matrix)} className="fill-black" />
    </svg>
  )
}

const shortLink = (link: string) => link.replace(/^https?:\/\//, '')

// 1순위: 신청 수(큰 숫자). 출석은 행사 당일부터 뜻이 있어 0이면 숨긴다(명세 3절 허용).
function Count({ item }: { item: CardForm }) {
  const { form, text } = item
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
      <p className="flex items-baseline gap-1.5">
        <span className={cn('text-fg-tertiary', type.body)}>신청</span>
        <span className={cn('text-fg', type.count)}>{form.applicantCount}</span>
        {form.capacity !== null && (
          <span className={cn('text-fg-tertiary', type.body)}>/ {form.capacity}명</span>
        )}
      </p>
      <p className={cn('pb-1 text-fg-muted', type.small)}>
        {form.attendedCount > 0 && `출석 ${form.attendedCount}명 · `}
        {text.period}
      </p>
    </div>
  )
}

function LinkRow({
  item,
  tone,
  props,
  toast,
}: { item: CardForm; tone: Tone } & Pick<CardProps, 'toast'> & { props: BuilderProps }) {
  const link = item.text.link!
  const copy = async () => {
    props.onCopy(item.form.id, link)
    try {
      await navigator.clipboard.writeText(link)
      toast('링크 복사 완료')
    } catch {
      toast('복사하지 못했어요. 주소를 길게 눌러 복사하세요.')
    }
  }
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 bg-surface-subtle p-2 pl-3', radius.inner)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-fg-tertiary"
        >
          <Link2 className="size-4" />
        </span>
        <span
          className={cn(
            'min-w-0 truncate',
            type.body,
            tone === 'ended' ? 'text-fg-muted' : 'text-fg-body',
          )}
        >
          {shortLink(link)}
        </span>
      </span>
      <Button
        data-measure="copy-link"
        variant={tone === 'open' ? 'default' : 'outline'}
        touch
        className="max-sm:w-full"
        onClick={() => void copy()}
      >
        링크 복사
      </Button>
    </div>
  )
}

function QrTile({ item, props }: { item: CardForm; props: BuilderProps }) {
  const [open, setOpen] = useState(false)
  const link = item.text.link!
  const label = `${item.text.name} 신청 링크 QR`
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 cursor-pointer flex-col items-center gap-1 self-start rounded-lg p-1 outline-none hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring/50 max-sm:flex-row max-sm:gap-3"
      >
        <span className="rounded-md border border-border-default bg-white p-0.5">
          <Qr measure="qr" text={link} label={label} className={size.qrThumb} />
        </span>
        <span className={cn('text-fg-tertiary', type.small)}>포스터용 QR</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm items-center">
          <DialogHeader className="self-stretch">
            <DialogTitle>포스터용 QR</DialogTitle>
          </DialogHeader>
          <Qr text={link} label={label} className={size.qrSheet} />
          <p className={cn('text-fg-muted wrap-anywhere', type.small)}>{shortLink(link)}</p>
          <Button touch className="self-stretch" onClick={() => props.onSaveQr(item.form.id)}>
            <Download aria-hidden />
            QR 저장
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}

// 받는 중·멈춤·종료: 신청 수와 링크 줄 왼쪽, QR 썸네일 오른쪽
export function LiveBody({
  item,
  tone,
  props,
  toast,
}: {
  item: CardForm
  tone: Tone
  props: BuilderProps
  toast: CardProps['toast']
}) {
  return (
    <div className={cn('grid gap-4 pb-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6', space.cardX)}>
      <div className="flex min-w-0 flex-col gap-3">
        <Count item={item} />
        <LinkRow item={item} tone={tone} props={props} toast={toast} />
      </div>
      <QrTile item={item} props={props} />
    </div>
  )
}
