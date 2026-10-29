import type { BuilderProps } from '../builder-props'
import { CardScreen } from './card'
import { EditorScreen } from './editor'

// v3 '설정 줄과 무대 모양'(양식 만들기 화면 시안). 이 폴더(v3/) 안만 고친다. 공용 파일은 읽기만 한다.
// card·empty = 쟁반 안 흰 묶음(왼쪽 사실 · 오른쪽 QR 자리), editor = 흰 설정 단(구역 줄) + 회색 무대(휴대폰 틀).
// 판 문서: notes/integration/events/form-builder-board.md, 보고: notes/integration/events/form-builder-v3.md
export default function BuilderV3(props: BuilderProps) {
  if (props.screen === 'editor' && props.data.editor) return <EditorScreen {...props} />
  return <CardScreen {...props} />
}
