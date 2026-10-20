import { useRef, type ChangeEvent } from 'react'
import type { RoomParticipant } from '@vada/contracts'
import { ImagePlus } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import PhotoStrip from './PhotoStrip'
import { SEND_ERRORS } from '@/lib/messages'
import { useComposer } from './useComposer'
import { useMentionInput } from './useMentionInput'

type Props = {
  councilId: string
  roomId: string
  participants: RoomParticipant[]
  meId: string
  // 보낸 뒤 흐름과 방 목록을 다시 읽게 한다.
  onSent: () => void
  // 방을 잃었다(401·403·404).
  onLost: () => void
}

// '@'를 치면 뜨는 참여자 목록. 고르면 "@이름 "이 들어간다.
function MentionList({
  people,
  onPick,
}: {
  people: RoomParticipant[]
  onPick: (person: RoomParticipant) => void
}) {
  return (
    <ul
      aria-label="부를 사람"
      className="flex max-h-40 flex-col overflow-y-auto rounded-sm border bg-white"
    >
      {people.map(person => (
        <li key={person.memberId}>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            // 눌러도 입력칸의 포커스가 풀리지 않게 한다.
            onMouseDown={event => event.preventDefault()}
            onClick={() => onPick(person)}
          >
            {person.name}
          </Button>
        </li>
      ))}
    </ul>
  )
}

// 사진 붙이기 버튼과 숨은 파일 입력. 같은 사진을 다시 골라도 알 수 있게 고른 뒤 비운다.
function PhotoPicker({ onPick }: { onPick: (files: File[]) => void }) {
  const files = useRef<HTMLInputElement>(null)
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    onPick(Array.from(event.target.files ?? []))
    event.target.value = ''
  }
  return (
    <>
      <Input
        ref={files}
        type="file"
        accept="image/*"
        multiple
        hidden
        tabIndex={-1}
        aria-label="사진 고르기"
        onChange={onChange}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="사진 붙이기"
        onClick={() => files.current?.click()}
      >
        <ImagePlus />
      </Button>
    </>
  )
}

// 입력칸: 글, '@' 부르기, 사진 붙이기, 보내기. 버튼은 계약의 검사로 켜고 끈다.
export default function Composer({ participants, meId, ...args }: Props) {
  const composer = useComposer(args)
  const { body, send, canSend, sending, error, readOnly, drafts } = composer
  const { field, people, onChange, onPick, onSelect } = useMentionInput(
    composer,
    participants,
    meId,
  )
  if (readOnly) return <StateMessage kind="notice">{SEND_ERRORS.ROOM_READ_ONLY}</StateMessage>
  return (
    <form
      className="flex flex-col gap-2 border-t bg-white pt-3"
      onSubmit={event => {
        event.preventDefault()
        void send()
      }}
    >
      {people.length > 0 && <MentionList people={people} onPick={onPick} />}
      <PhotoStrip photos={drafts.photos} onRemove={drafts.remove} />
      {drafts.note && <StateMessage kind="error">{drafts.note}</StateMessage>}
      <div className="flex items-end gap-2">
        <PhotoPicker onPick={drafts.add} />
        <Textarea
          ref={field}
          rows={1}
          aria-label="메시지"
          placeholder="메시지를 입력하세요. @로 사람을 부를 수 있어요."
          className="min-h-10 flex-1"
          value={body}
          onChange={onChange}
          onSelect={event => onSelect(event.currentTarget.selectionStart)}
        />
        <Button type="submit" disabled={!canSend}>
          {sending ? '보내는 중…' : '보내기'}
        </Button>
      </div>
      {error && <StateMessage kind="error">{error}</StateMessage>}
    </form>
  )
}
