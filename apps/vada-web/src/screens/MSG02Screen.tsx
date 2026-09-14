import { MessageRoomActions } from './message-room-editor/MessageRoomActions'
import { MessageRoomFields } from './message-room-editor/MessageRoomFields'
import { MessageRoomHeader } from './message-room-editor/MessageRoomHeader'
import { MessageRoomModal } from './message-room-editor/MessageRoomModal'
import {
  useMessageRoomDraft,
  type MessageRoomDraftProps,
} from './message-room-editor/useMessageRoomDraft'

// 새 메시지 방 만들기(MSG-02). 화면은 모달 셸, 폼 모델, 세 렌더링 영역을 조립한다.
export function MSG02Screen(props: MessageRoomDraftProps) {
  const model = useMessageRoomDraft(props)
  return (
    <MessageRoomModal onClose={() => model.goBack(model.close)}>
      <MessageRoomHeader model={model} />
      <MessageRoomFields model={model} />
      <MessageRoomActions model={model} />
    </MessageRoomModal>
  )
}
