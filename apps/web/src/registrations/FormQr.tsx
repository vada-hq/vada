import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { qrMatrix, qrPath } from '@/lib/qr-code'
import { MainButton } from './DocParts'

// 포스터용 QR: 카드 머리 띠의 96px 썸네일(누르면 큰 QR 창)과 [QR 저장]. 바탕은 늘 흰색이고 여백은 matrix에 들어 있다.

function QrSvg({ link, label, className }: { link: string; label: string; className: string }) {
  const matrix = qrMatrix(link)
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${matrix.length} ${matrix.length}`}
      shapeRendering="crispEdges"
      className={`${className} rounded-md bg-white`}
    >
      <path d={qrPath(matrix)} className="fill-black" />
    </svg>
  )
}

// 포스터에 넣을 QR을 SVG 파일로 내려받는다(크기를 키워도 깨지지 않는다). 서버에 보내지 않는다.
export function saveQr(link: string, name: string) {
  const matrix = qrMatrix(link)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${matrix.length} ${matrix.length}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${qrPath(matrix)}"/></svg>`
  const anchor = document.createElement('a')
  anchor.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  anchor.download = `${name} 신청 QR.svg`
  anchor.click()
}

export function PosterQr({
  link,
  name,
  onOpen,
}: {
  link: string
  name: string
  onOpen: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-label={`${name} QR 크게 보기`}
      onClick={onOpen}
      className="h-auto shrink-0 rounded-lg border-border-default p-0.5 hover:border-border-strong hover:bg-white [&_svg]:size-24"
    >
      <QrSvg link={link} label={`${name} 신청 링크 QR`} className="size-24" />
    </Button>
  )
}

export function QrDialog({
  link,
  name,
  open,
  onOpenChange,
}: {
  link: string
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="items-center sm:max-w-sm">
        <DialogHeader className="self-stretch">
          <DialogTitle>포스터용 QR</DialogTitle>
        </DialogHeader>
        <QrSvg link={link} label={`${name} 신청 링크 큰 QR`} className="size-60" />
        <MainButton icon={Download} className="w-full" onClick={() => saveQr(link, name)}>
          QR 저장
        </MainButton>
      </DialogContent>
    </Dialog>
  )
}
