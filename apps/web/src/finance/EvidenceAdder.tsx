import { useRef, type ChangeEvent } from 'react'
import { EVIDENCE_TYPES, type EvidenceType } from '@vada/contracts'
import { ImagePlus, MessageSquare, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { ChatPhotoPicker } from './ChatPhotoPicker'
import { EVIDENCE_TYPE_LABEL } from './expense-view'
import type { useChatEvidence } from './useChatEvidence'
import type { useEvidenceUpload } from './useEvidenceUpload'

type Upload = ReturnType<typeof useEvidenceUpload>
type Chat = ReturnType<typeof useChatEvidence>

// 카메라나 앨범에서 고르는 숨은 파일 입력. 같은 사진을 다시 골라도 알 수 있게 고른 뒤 비운다.
function PhotoPicker({ onPick, onChat }: { onPick: (file: File) => void; onChat: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onPick(file)
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        aria-label="증빙 사진 고르기"
        onChange={onChange}
      />
      <Button type="button" variant="outline" onClick={() => input.current?.click()}>
        <ImagePlus aria-hidden />
        사진 올리기
      </Button>
      <Button type="button" variant="outline" onClick={onChat}>
        <MessageSquare aria-hidden />
        대화에서 고르기
      </Button>
    </div>
  )
}

// 고른 사진의 미리 보기, 종류 고르기, [붙이기]. 올리는 중과 실패는 그 자리에 보인다.
function PendingCard({ upload }: { upload: Upload }) {
  const { photo, type, setType, attaching } = upload
  if (!photo) return null
  return (
    <div role="group" aria-label="붙일 사진" className="flex flex-col gap-3 rounded-sm border p-3">
      <div className="relative size-24 overflow-hidden rounded-sm border bg-surface-subtle">
        {photo.preview && (
          <img src={photo.preview} alt={photo.name} className="size-full object-cover" />
        )}
        {photo.state === 'uploading' && (
          <span className="absolute inset-0 grid place-items-center bg-white/70 text-xs text-fg-tertiary">
            올리는 중…
          </span>
        )}
      </div>
      <Label className="flex flex-col gap-2">
        종류
        <NativeSelect
          value={type}
          disabled={attaching}
          onChange={event => setType(event.target.value as EvidenceType)}
        >
          {EVIDENCE_TYPES.map(item => (
            <option key={item} value={item}>
              {EVIDENCE_TYPE_LABEL[item]}
            </option>
          ))}
        </NativeSelect>
      </Label>
      <div className="flex flex-wrap gap-2">
        {photo.state !== 'failed' && (
          <Button
            type="button"
            busy={photo.state === 'uploading' || attaching}
            onClick={() => void upload.attach()}
          >
            붙이기
          </Button>
        )}
        <Button type="button" variant="outline" busy={attaching} onClick={upload.clear}>
          <X aria-hidden />
          빼기
        </Button>
      </div>
    </div>
  )
}

// 증빙 사진 붙이기. 올리거나 대화에서 골라 한 장씩, 미리 본 뒤 종류를 정해 붙인다. 오류는 이 칸 안에 보인다.
export function EvidenceAdder({
  councilId,
  upload,
  chat,
}: {
  councilId: string
  upload: Upload
  chat: Chat
}) {
  return (
    <div className="flex flex-col gap-3">
      {!upload.photo && !chat.open && (
        <PhotoPicker onPick={file => void upload.pick(file)} onChat={chat.show} />
      )}
      <PendingCard upload={upload} />
      {chat.open && !upload.photo && <ChatPhotoPicker councilId={councilId} chat={chat} />}
    </div>
  )
}
