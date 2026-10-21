import { useRef, type ChangeEvent } from 'react'
import { EVIDENCE_TYPES, type EvidenceType } from '@vada/contracts'
import { ImagePlus, X } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { EVIDENCE_TYPE_LABEL } from './expense-view'
import type { useEvidenceUpload } from './useEvidenceUpload'

type Upload = ReturnType<typeof useEvidenceUpload>

// 카메라나 앨범에서 고르는 숨은 파일 입력. 같은 사진을 다시 골라도 알 수 있게 고른 뒤 비운다.
function PhotoPicker({ onPick }: { onPick: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onPick(file)
  }
  return (
    <>
      <Input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        aria-label="증빙 사진 고르기"
        onChange={onChange}
      />
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => input.current?.click()}
      >
        <ImagePlus aria-hidden />
        사진 올리기
      </Button>
    </>
  )
}

// 고른 사진의 미리 보기, 종류 고르기, [붙이기]. 올리는 중과 실패는 그 자리에 보인다.
function PendingCard({ upload }: { upload: Upload }) {
  const { photo, type, setType, attaching } = upload
  if (!photo) return null
  return (
    <div role="group" aria-label="붙일 사진" className="flex flex-col gap-3 rounded-sm border p-3">
      <div className="relative size-24 overflow-hidden rounded-sm border bg-gray-50">
        {photo.preview && (
          <img src={photo.preview} alt={photo.name} className="size-full object-cover" />
        )}
        {photo.state === 'uploading' && (
          <span className="absolute inset-0 grid place-items-center bg-white/70 text-xs text-gray-600">
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
        <Button
          type="button"
          disabled={photo.state !== 'ready' || attaching}
          onClick={() => void upload.attach()}
        >
          붙이기
        </Button>
        <Button type="button" variant="outline" disabled={attaching} onClick={upload.clear}>
          <X aria-hidden />
          빼기
        </Button>
      </div>
    </div>
  )
}

// 증빙 사진 붙이기. 한 장씩 고르고, 미리 본 뒤 종류를 정해 붙인다. 오류는 이 칸 안에 보인다.
export function EvidenceAdder({ upload }: { upload: Upload }) {
  return (
    <div className="flex flex-col gap-3">
      {!upload.photo && <PhotoPicker onPick={file => void upload.pick(file)} />}
      <PendingCard upload={upload} />
      {upload.problem && <StateMessage kind="error">{upload.problem}</StateMessage>}
    </div>
  )
}
