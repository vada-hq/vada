import type { BuilderProps } from '../builder-props'
import { CardScreen, EmptyScreen } from './card'
import { EditorScreen } from './editor'

// v1 '카드 더미 모양'(refs 2.1): 회색 쟁반 위에 흰 카드를 쌓는다.
// 편집기 = 고친 카드 하나만 펼치는 카드 더미 + 오른쪽 고정 휴대폰 틀, 양식 카드 = 윗변 상태 띠 카드, 빈 상태 = 점선 카드 자리.
// 이 폴더(v1/) 안만 고친다. 판 문서: notes/integration/events/form-builder-board.md
export default function BuilderV1(props: BuilderProps) {
  if (props.screen === 'editor' && props.data.editor) return <EditorScreen {...props} />
  if (props.screen === 'empty') return <EmptyScreen {...props} />
  return <CardScreen {...props} />
}
