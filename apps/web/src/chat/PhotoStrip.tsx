import { X } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { PhotoDraft } from './usePhotoDrafts'

type Props = { photos: PhotoDraft[]; onRemove: (id: number) => void }

function Thumb({ photo, onRemove }: { photo: PhotoDraft; onRemove: (id: number) => void }) {
  return (
    <li className="flex max-w-full flex-col gap-1">
      <div className="relative size-20 overflow-hidden rounded-sm border bg-surface-subtle">
        {photo.preview && (
          <img src={photo.preview} alt={photo.name} className="size-full object-cover" />
        )}
        {photo.state === 'uploading' && (
          <span className="absolute inset-0 grid place-items-center bg-white/70 text-xs text-fg-tertiary">
            올리는 중…
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${photo.name} 빼기`}
          className="absolute top-0 right-0 size-6 bg-white/80"
          onClick={() => onRemove(photo.id)}
        >
          <X aria-hidden className="size-4" />
        </Button>
      </div>
      {photo.error && (
        <StateMessage kind="error" className="max-w-40 text-xs">
          {photo.error}
        </StateMessage>
      )}
    </li>
  )
}

// 보낼 사진 줄. 올리는 중이거나 실패한 사진은 그 자리에서 알리고, 빼기로 치운다.
export default function PhotoStrip({ photos, onRemove }: Props) {
  if (photos.length === 0) return null
  return (
    <ul aria-label="보낼 사진" className="flex flex-wrap gap-2">
      {photos.map(photo => (
        <Thumb key={photo.id} photo={photo} onRemove={onRemove} />
      ))}
    </ul>
  )
}
