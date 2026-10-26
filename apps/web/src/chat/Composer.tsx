import { useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import type { RoomParticipant } from '@vada/contracts'
import { ImagePlus, SendHorizontal } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import DirectPickList from './DirectPickList'
import PhotoStrip from './PhotoStrip'
import { SEND_ERRORS } from '@/lib/messages'
import { useComposer } from './useComposer'
import { useDirectInput } from './useDirectInput'
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
  // 1:1 패널의 보내기 버튼 글('{이름}에게 보내기'). 없으면 그림 버튼이다.
  sendLabel?: string | undefined
  // 답글 입력칸이면 원글 번호(022 조각 11). 사진·부르기·실패 보존은 방 입력칸과 같고 글은 원글마다 남는다.
  replyTo?: string | undefined
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

// 글이 있으면(1:1 패널) 받는 사람을 적은 글 버튼이다. 오발송을 막는다(와이어프레임 MSG-04, Slack Connect 받는 사람 띠).
function SendButton({
  sending,
  disabled,
  label,
}: {
  sending: boolean
  disabled: boolean
  label?: string | undefined
}) {
  return (
    <Button
      type="submit"
      size={label ? 'md' : 'icon'}
      touch={!!label}
      className={label ? 'max-w-full' : 'size-10'}
      aria-label={label ? undefined : sending ? '보내는 중' : '보내기'}
      // oxlint-disable-next-line react/forbid-component-props -- 대화 [보내기]는 빈 메시지일 때 꺼진다(채팅 앱의 관례, AGENTS.md '화면 문구와 폼'의 예외).
      disabled={disabled}
    >
      {label ? <span className="truncate">{label}</span> : <SendHorizontal />}
    </Button>
  )
}

// 입력칸의 이름. 답글 입력칸은 '답글'이다(022 조각 11).
const fieldLabel = (replyTo: string | undefined) => (replyTo ? '답글' : '메시지')

// 입력칸: 글, '@' 부르기, 사진 붙이기, 보내기. 버튼은 계약의 검사로 켜고 끈다.
export default function Composer({ participants, meId, sendLabel, ...args }: Props) {
  const composer = useComposer({ ...args, meId })
  const { body, send, canSend, sending, error, readOnly, drafts } = composer
  const { field, people, onChange, onPick, onSelect } = useMentionInput(
    composer,
    participants,
    meId,
  )
  // 첫 글자가 '/'면 보내지 않고 1:1 대화할 사람을 고른다(022 조각 7).
  const direct = useDirectInput(body, composer.setBody)
  if (readOnly) return <StateMessage kind="notice">{SEND_ERRORS.ROOM_READ_ONLY}</StateMessage>
  return (
    <form
      className="flex flex-col gap-2 border-t bg-white pt-3"
      onSubmit={event => {
        event.preventDefault()
        if (!direct.people) void send()
      }}
    >
      {direct.people && <DirectPickList people={direct.people} onPick={direct.pick} />}
      {people.length > 0 && <MentionList people={people} onPick={onPick} />}
      <PhotoStrip photos={drafts.photos} onRemove={drafts.remove} />
      {drafts.note && <StateMessage kind="error">{drafts.note}</StateMessage>}
      <div className="flex items-end gap-2">
        <PhotoPicker onPick={drafts.add} />
        <Textarea
          ref={field}
          rows={1}
          aria-label={fieldLabel(args.replyTo)}
          className="min-h-10 flex-1"
          value={body}
          onChange={onChange}
          onKeyDown={event => {
            if (direct.people) return direct.onKeyDown(event)
            if (!sendsOnEnter(event) || people.length > 0) return
            event.preventDefault()
            if (canSend) void send()
          }}
          onSelect={event => onSelect(event.currentTarget.selectionStart)}
        />
        {!sendLabel && <SendButton sending={sending} disabled={!canSend || !!direct.people} />}
      </div>
      {/* 1:1 패널은 폭이 좁아 받는 사람을 적은 버튼을 입력칸 아래 오른쪽에 둔다(와이어프레임 MSG-04). */}
      {sendLabel && (
        <div className="flex justify-end">
          <SendButton sending={sending} disabled={!canSend || !!direct.people} label={sendLabel} />
        </div>
      )}
      {error && <StateMessage kind="error">{error}</StateMessage>}
    </form>
  )
}
