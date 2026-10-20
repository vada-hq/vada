import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { ChatPhoto } from '@vada/contracts'
import { filePath } from './chat-api'

// 메시지에 붙은 사진. 누르면 크게 보인다. 주소는 참여자에게만 열리는 보기 경로(서명 주소로 넘어간다)다.
export default function MessagePhotos({
  councilId,
  photos,
}: {
  councilId: string
  photos: ChatPhoto[]
}) {
  return (
    <ul aria-label="사진" className="mt-2 flex flex-wrap gap-2">
      {photos.map(photo => {
        const src = filePath(councilId, photo.id)
        return (
          <li key={photo.id}>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" aria-label="사진 크게 보기" className="h-auto p-0">
                  <img src={src} alt="사진" loading="lazy" className="max-h-40 rounded-sm" />
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby={undefined}>
                <DialogHeader>
                  <DialogTitle>사진</DialogTitle>
                </DialogHeader>
                <img src={src} alt="사진" className="max-h-96 w-full object-contain" />
              </DialogContent>
            </Dialog>
          </li>
        )
      })}
    </ul>
  )
}
