import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export type ThumbPhoto = { id: string; src: string; alt: string }

// 서버에 올라간 사진 줄. 누르면 크게 보인다. 주소는 참여자에게만 열리는 보기 경로(서명 주소로 넘어간다)다.
// 보이는 글(alt)은 사진 위에서 크게 보기 대화상자의 제목이 된다. 대화 사진과 지출 증빙이 같이 쓴다.
export default function PhotoThumbs({ label, photos }: { label: string; photos: ThumbPhoto[] }) {
  return (
    <ul aria-label={label} className="mt-2 flex flex-wrap gap-2">
      {photos.map(photo => (
        <li key={photo.id}>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" aria-label={`${photo.alt} 크게 보기`} className="h-auto p-0">
                <img
                  src={photo.src}
                  alt={photo.alt}
                  loading="lazy"
                  className="max-h-40 rounded-sm"
                />
              </Button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>{photo.alt}</DialogTitle>
              </DialogHeader>
              <img src={photo.src} alt={photo.alt} className="max-h-96 w-full object-contain" />
            </DialogContent>
          </Dialog>
        </li>
      ))}
    </ul>
  )
}
