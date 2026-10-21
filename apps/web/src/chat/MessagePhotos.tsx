import type { ChatPhoto } from '@vada/contracts'
import PhotoThumbs from '@/components/PhotoThumbs'
import { filePath } from './chat-api'

// 메시지에 붙은 사진. 누르면 크게 보인다.
export default function MessagePhotos({
  councilId,
  photos,
}: {
  councilId: string
  photos: ChatPhoto[]
}) {
  return (
    <PhotoThumbs
      label="사진"
      photos={photos.map(photo => ({
        id: photo.id,
        src: filePath(councilId, photo.id),
        alt: '사진',
      }))}
    />
  )
}
