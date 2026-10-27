import { EVIDENCE_TYPES, type ChatPhotoListResponse, type EvidenceType } from '@vada/contracts'
import { X } from 'lucide-react'
import { filePath } from '@/chat/chat-api'
import { roomName, timeLabel } from '@/chat/chat-view'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { CHAT_PHOTOS_FAILED } from '@/lib/messages'
import { useNow } from '@/lib/use-now'
import { EVIDENCE_TYPE_LABEL } from './expense-view'
import type { useChatEvidence } from './useChatEvidence'

type Chat = ReturnType<typeof useChatEvidence>
type Photo = ChatPhotoListResponse['photos'][number]

const senderOf = (photo: Photo) => photo.senderName ?? '알 수 없는 사람'

// 목록의 사진 한 칸. 작은 사진과 방 이름·보낸 사람·시각. 긴 이름은 줄바꿈한다.
function PhotoRow({
  councilId,
  photo,
  disabled,
  onChoose,
}: {
  councilId: string
  photo: Photo
  disabled: boolean
  onChoose: () => void
}) {
  const now = useNow()
  return (
    <li>
      <Button
        type="button"
        variant="ghost"
        busy={disabled}
        onClick={onChoose}
        className="h-auto w-full justify-start gap-3 p-2 text-left whitespace-normal"
      >
        <img
          src={filePath(councilId, photo.id)}
          alt=""
          loading="lazy"
          className="size-16 shrink-0 rounded-sm border object-cover"
        />
        <span className="flex min-w-0 flex-col gap-0.5 text-xs wrap-anywhere">
          <span className="font-medium text-gray-700">{roomName(photo.room)}</span>
          <span>{senderOf(photo)}</span>
          <span>{timeLabel(photo.sentAt, now)}</span>
        </span>
      </Button>
    </li>
  )
}

// 고른 사진의 미리 보기, 종류, 공개 안내, [붙이기]. 사진은 올리지 않고 대화의 것을 복사한다.
function ChosenCard({ councilId, photo, chat }: { councilId: string; photo: Photo; chat: Chat }) {
  return (
    <div
      role="group"
      aria-label="붙일 대화 사진"
      className="flex flex-col gap-3 rounded-sm border p-3"
    >
      <img
        src={filePath(councilId, photo.id)}
        alt={`${roomName(photo.room)} ${senderOf(photo)}의 사진`}
        className="max-h-40 w-full rounded-sm border bg-gray-50 object-contain"
      />
      <Label className="flex flex-col gap-2">
        종류
        <NativeSelect
          value={chat.type}
          disabled={chat.attaching}
          onChange={event => chat.setType(event.target.value as EvidenceType)}
        >
          {EVIDENCE_TYPES.map(item => (
            <option key={item} value={item}>
              {EVIDENCE_TYPE_LABEL[item]}
            </option>
          ))}
        </NativeSelect>
      </Label>
      <StateMessage kind="notice">증빙은 모든 운영진이 봐요.</StateMessage>
      <div className="flex flex-wrap gap-2">
        <Button type="button" busy={chat.attaching} onClick={() => void chat.attach()}>
          붙이기
        </Button>
        <Button
          type="button"
          variant="outline"
          busy={chat.attaching}
          onClick={() => chat.choose(null)}
        >
          다시 고르기
        </Button>
      </div>
    </div>
  )
}

function PhotoList({ councilId, chat }: { councilId: string; chat: Chat }) {
  const { list } = chat
  if (list.kind === 'loading') return <StateMessage kind="loading">불러오는 중이에요</StateMessage>
  if (list.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-2">
        <StateMessage kind="error">{CHAT_PHOTOS_FAILED}</StateMessage>
        <Button type="button" variant="outline" onClick={() => void chat.reload()}>
          다시 시도
        </Button>
      </div>
    )
  if (list.data.photos.length === 0)
    return <StateMessage kind="empty">고를 수 있는 대화 사진 없음</StateMessage>
  return (
    <>
      <ul aria-label="대화 사진 목록" className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {list.data.photos.map(photo => (
          <PhotoRow
            key={photo.id}
            councilId={councilId}
            photo={photo}
            disabled={chat.attaching}
            onChoose={() => chat.choose(photo.id)}
          />
        ))}
      </ul>
      {list.data.truncated && (
        <StateMessage kind="notice">
          최근 사진 {list.data.photos.length}장만 보여요. 더 오래된 사진은 대화에서 직접 찾아 올려
          주세요.
        </StateMessage>
      )}
    </>
  )
}

// 대화에서 사진 고르기 칸. 고르기 전에는 목록, 고른 뒤에는 미리 보기와 [붙이기]다. 오류는 이 칸 안에 보인다.
export function ChatPhotoPicker({ councilId, chat }: { councilId: string; chat: Chat }) {
  return (
    <div role="group" aria-label="대화에서 사진 고르기" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-gray-700">대화에서 고르기</h4>
        <Button type="button" variant="ghost" size="sm" busy={chat.attaching} onClick={chat.close}>
          <X aria-hidden />
          닫기
        </Button>
      </div>
      {chat.chosen ? (
        <ChosenCard councilId={councilId} photo={chat.chosen} chat={chat} />
      ) : (
        <PhotoList councilId={councilId} chat={chat} />
      )}
      {chat.problem && <StateMessage kind="error">{chat.problem}</StateMessage>}
    </div>
  )
}
