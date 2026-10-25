import type { KeyboardEvent } from 'react'

// 한글처럼 조합해 쓰는 글자를 치는 중인 키(IME). 이때의 Enter는 조합을 끝내는 것이고 Esc는 조합을 거두는 것이다.
const COMPOSING_KEY_CODE = 229

// 제자리 편집의 Enter 저장·Esc 취소가 조합 중의 키를 받지 않게 한다. Safari는 조합 중 isComposing 대신 keyCode 229만 준다.
export const isComposingKey = (event: KeyboardEvent) =>
  event.nativeEvent.isComposing || event.keyCode === COMPOSING_KEY_CODE
