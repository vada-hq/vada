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
import {
  DIRECT_PEOPLE_LABEL,
  DIRECT_PEOPLE_EMPTY,
  MENTION_INPUT_HINT,
  MESSAGE_INPUT_HINT,
  sendToPerson,
  sendToRoom,
} from './message-text'
import { useDirectInput } from './SideChatInput'

type Props = {
  councilId: string
  roomId: string
  roomName: string
  participants: RoomParticipant[]
  meId: string
  direct?: boolean
  autoFocus?: boolean
  // 보낸 뒤 흐름과 방 목록을 다시 읽게 한다.
  onSent: () => void
  // 방을 잃었다(401·403·404).
  onLost: () => void
}

// '@'를 치면 뜨는 참여자 목록. 고르면 "@이름 "이 들어간다.
function MentionList({
  people,
  onPick,
  label = '부를 사람',
  busy = false,
}: {
  people: RoomParticipant[]
  onPick: (person: RoomParticipant) => void
  label?: string
  busy?: boolean
}) {
  return (
    <ul
      aria-label={label}
      className="flex max-h-40 flex-col overflow-y-auto rounded-sm border bg-white"
    >
      {people.map(person => (
        <li key={person.memberId}>
          <Button
            type="button"
            variant="ghost"
            touch
            busy={busy}
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
        touch
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

function ComposerSuggestions({
  direct,
  people,
  onPick,
}: {
  direct: ReturnType<typeof useDirectInput>
  people: RoomParticipant[]
  onPick: (person: RoomParticipant) => void
}) {
  if (!direct.active) return people.length > 0 && <MentionList people={people} onPick={onPick} />
  if (direct.people.length === 0)
    return <StateMessage kind="empty">{DIRECT_PEOPLE_EMPTY}</StateMessage>
  return (
    <MentionList
      label={DIRECT_PEOPLE_LABEL}
      people={direct.people}
      busy={direct.busy}
      onPick={person => void direct.pick(person)}
    />
  )
}

function composerKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  input: {
    direct: ReturnType<typeof useDirectInput>
    hasMentions: boolean
    canSend: boolean
    send: () => Promise<void>
  },
) {
  if (input.direct.active) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    const first = input.direct.people[0]
    if (first) void input.direct.pick(first)
    return
  }
  if (!sendsOnEnter(event) || input.hasMentions) return
  event.preventDefault()
  if (input.canSend) void input.send()
}

function SendButton({
  sending,
  disabled,
  name,
}: {
  sending: boolean
  disabled: boolean
  name: string
}) {
  return (
    <Button
      type="submit"
      busy={sending}
      touch
      className="ml-auto min-h-11 shrink-0 max-sm:size-11 max-sm:px-0"
      aria-label={name}
      // oxlint-disable-next-line react/forbid-component-props -- 대화 [보내기]는 빈 메시지일 때 꺼진다(채팅 앱의 관례, AGENTS.md '화면 문구와 폼'의 예외).
      disabled={disabled}
    >
      <SendHorizontal aria-hidden />
      <span className="hidden max-w-56 truncate sm:inline">{name}</span>
    </Button>
  )
}

// 입력칸: 글, '@' 부르기, 사진 붙이기, 보내기. 버튼은 계약의 검사로 켜고 끈다.
export default function Composer({
  participants,
  meId,
  roomName,
  direct = false,
  autoFocus = false,
  ...args
}: Props) {
  const composer = useComposer({ ...args, meId })
  const { body, send, canSend, sending, error, readOnly, drafts } = composer
  const { field, people, onChange, onPick, onSelect } = useMentionInput(
    composer,
    participants,
    meId,
  )
  const directInput = useDirectInput(composer, {
    councilId: args.councilId,
    roomId: args.roomId,
    meId,
  })
  if (readOnly) return <StateMessage kind="notice">{SEND_ERRORS.ROOM_READ_ONLY}</StateMessage>
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={event => {
        event.preventDefault()
        if (!directInput.active) void send()
      }}
    >
      <ComposerSuggestions direct={directInput} people={people} onPick={onPick} />
      <PhotoStrip photos={drafts.photos} onRemove={drafts.remove} />
      {drafts.note && <StateMessage kind="error">{drafts.note}</StateMessage>}
      {/* 좁은 칸(오른쪽 1:1 칸, 1024px의 흐름)에서는 [보내기]가 다음 줄 오른쪽으로 내려가 입력칸 폭을 지킨다(MSG-04 사이드챗 입력 띠). */}
      <div className="flex flex-wrap items-end gap-2">
        <PhotoPicker onPick={drafts.add} />
        <Textarea
          ref={field}
          autoFocus={autoFocus}
          rows={1}
          aria-label="메시지"
          className="min-h-11 min-w-0 flex-1 basis-56"
          // oxlint-disable-next-line react/forbid-component-props -- v7 입력 띠 명세가 채팅의 @ 부르기 안내를 자리 글로 요구한다.
          placeholder={directInput.canDirect ? MESSAGE_INPUT_HINT : MENTION_INPUT_HINT}
          value={body}
          onChange={onChange}
          onKeyDown={event =>
            composerKey(event, {
              direct: directInput,
              hasMentions: people.length > 0,
              canSend,
              send,
            })
          }
          onSelect={event => onSelect(event.currentTarget.selectionStart)}
        />
        <SendButton
          sending={sending}
          disabled={!canSend || directInput.active}
          name={direct ? sendToPerson(roomName) : sendToRoom(roomName)}
        />
      </div>
      {error && <StateMessage kind="error">{error}</StateMessage>}
    </form>
  )
}
