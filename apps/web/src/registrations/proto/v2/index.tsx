import type { BuilderProps } from '../builder-props'
import { CardScreen } from './card'
import { EditorScreen } from './editor'

// v2 '문서 한 장 모양'(양식 만들기 화면 시안). 이 폴더(v2/) 안만 고친다. 공용 파일은 읽기만 한다.
// 기본 내보내기 하나가 세 화면(props.screen: card·editor·empty)을 모두 그린다. 행사 화면 탭 안 내용 영역만 그린다.
// 판 문서: notes/integration/events/form-builder-board.md, 보고: notes/integration/events/form-builder-v2.md
export default function BuilderV2(props: BuilderProps) {
  if (props.screen === 'editor' && props.data.editor) return <EditorScreen {...props} />
  return <CardScreen {...props} />
}
