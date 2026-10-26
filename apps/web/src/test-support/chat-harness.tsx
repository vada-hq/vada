import { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import type { Action } from '@vada/contracts'
import ChatPage, { type Screen } from '@/chat/ChatPage'
import DirectPanel from '@/chat/DirectPanel'
import { DirectOpenContext } from '@/chat/direct-open'
import { SidePanelOpeners, useSidePanels } from '@/chat/side-panels'
import { useDirectPanel } from '@/chat/useDirectPanel'
import { useRoomList } from '@/chat/useRoomList'
import { useTeam } from '@/team/useTeam'
import { messagePage, roomDetail, roomList } from './chat-fixtures'
import { councilView, MEMBER_PERMISSIONS, teamResponse } from './council-fixtures'
import { json, mockApi } from './mock-api'

export const chatBase = '/api/organizations/c1'

// 권한이 바뀌면(403) 학생회를 다시 읽어 권한이 줄어든 모습을 받는다.
export function ChatHarness({
  permissions = MEMBER_PERMISSIONS,
  memberId,
  onOpenRequest = () => {},
}: {
  permissions?: Action[]
  memberId?: string
  onOpenRequest?: (requestId: string) => void
}) {
  const [granted, setGranted] = useState(permissions)
  const team = useTeam('c1', () => {})
  const rooms = useRoomList('c1', () => {}, true)
  // 실제 앱에서는 주소가 정하는 화면을 상태로 둔다.
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  return (
    <ChatPage
      councilId="c1"
      view={councilView('c1', { permissions: granted, memberId })}
      team={team}
      rooms={rooms}
      onForbidden={() => setGranted(MEMBER_PERMISSIONS)}
      onOpenRequest={onOpenRequest}
      screen={screen}
      onScreen={setScreen}
      onBack={() => setScreen({ kind: 'list' })}
    />
  )
}

// 작업 공간처럼 1:1 패널을 대화 화면 옆에 둔다(022 조각 7). 이름 누르기와 '/'가 이 패널을 연다.
export function DirectChatHarness() {
  const team = useTeam('c1', () => {})
  const rooms = useRoomList('c1', () => {}, true)
  const [view] = useState(() => councilView('c1', { permissions: MEMBER_PERMISSIONS }))
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  const page = { councilId: 'c1', view, team, rooms, onForbidden: () => {} }
  const direct = useDirectPanel(page)
  return (
    <DirectOpenContext value={direct.opener}>
      <ChatPage
        {...page}
        onOpenRequest={() => {}}
        screen={screen}
        onScreen={setScreen}
        onBack={() => setScreen({ kind: 'list' })}
      />
      {direct.target && (
        <DirectPanel
          page={{ ...page, onOpenRequest: () => {} }}
          target={direct.target}
          onClose={direct.close}
        />
      )}
    </DirectOpenContext>
  )
}

// 작업 공간처럼 오른쪽 자리 하나에 1:1·답글·상품 정보를 둔다(022 조각 6·7·11). screen을 주면 그 화면(답글 알림 주소)으로 시작한다.
export function SideChatHarness({
  start = { kind: 'list' },
  permissions = MEMBER_PERMISSIONS,
}: {
  start?: Screen
  permissions?: Action[]
}) {
  const team = useTeam('c1', () => {})
  const rooms = useRoomList('c1', () => {}, true)
  const [view] = useState(() => councilView('c1', { permissions }))
  const [screen, setScreen] = useState<Screen>(start)
  const page = { councilId: 'c1', view, team, rooms, onForbidden: () => {} }
  const panels = useSidePanels({ ...page, onOpenRequest: () => {} })
  return (
    <SidePanelOpeners panels={panels}>
      <ChatPage
        {...page}
        onOpenRequest={() => {}}
        screen={screen}
        onScreen={setScreen}
        onBack={() => setScreen({ kind: 'list' })}
      />
      {panels.panel}
    </SidePanelOpeners>
  )
}

// 방 목록과 공지방 하나의 읽기 응답을 등록한다.
export function serveChat() {
  const api = mockApi()
  api.on('GET', `${chatBase}/rooms`, () => json(roomList()))
  api.on('GET', `${chatBase}/members`, () => json(teamResponse()))
  api.on('GET', `${chatBase}/rooms/r1`, () => json(roomDetail()))
  api.on('GET', `${chatBase}/rooms/r1/messages`, () => json(messagePage()))
  api.on('POST', `${chatBase}/rooms/r1/read`, () => new Response(null, { status: 204 }))
  return api
}

export const openAllRoom = async () =>
  fireEvent.click(await screen.findByRole('button', { name: /공지방/ }))
