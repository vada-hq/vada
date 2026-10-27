import { useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import type { RoomParticipant } from '@vada/contracts'
import { ImagePlus, SendHorizontal } from 'lucide-react'
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

// 마우스와 키보드로 쓰면 Enter가 보내기, Shift+Enter가 줄바꿈이다. 휴대폰은 Enter가 줄바꿈이고 버튼으로 보낸다.
// 한글을 조합하는 중의 Enter는 글자를 끝내는 것이라 보내지 않는다.
function sendsOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return false
  return window.matchMedia?.('(pointer: fine)').matches ?? false
}

function SendButton({ sending, disabled }: { sending: boolean; disabled: boolean }) {
  return (
    <Button
      type="submit"
      size="icon"
      className="size-10"
      aria-label={sending ? '보내는 중' : '보내기'}
      // oxlint-disable-next-line react/forbid-component-props -- 대화 [보내기]는 빈 메시지일 때 꺼진다(채팅 앱의 관례, AGENTS.md '화면 문구와 폼'의 예외).
      disabled={disabled}
    >
      <SendHorizontal />
    </Button>
  )
}

// 입력칸: 글, '@' 부르기, 사진 붙이기, 보내기. 버튼은 계약의 검사로 켜고 끈다.
export default function Composer({ participants, meId, ...args }: Props) {
  const composer = useComposer({ ...args, meId })
  const { body, send, canSend, sending, error, readOnly, drafts } = composer
  const { field, people, onChange, onPick, onSelect } = useMentionInput(
    composer,
    participants,
    meId,
  )
  if (readOnly) return <StateMessage kind="notice">{SEND_ERRORS.ROOM_READ_ONLY}</StateMessage>
  return (
    <form
      className="flex flex-col gap-2"
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
          className="min-h-10 flex-1"
          value={body}
          onChange={onChange}
          onKeyDown={event => {
            if (!sendsOnEnter(event) || people.length > 0) return
            event.preventDefault()
            if (canSend) void send()
          }}
          onSelect={event => onSelect(event.currentTarget.selectionStart)}
        />
        <SendButton sending={sending} disabled={!canSend} />
      </div>
      {error && <StateMessage kind="error">{error}</StateMessage>}
    </form>
  )
}
