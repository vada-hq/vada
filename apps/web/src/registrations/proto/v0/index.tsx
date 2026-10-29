import type { BuilderProps } from '../builder-props'
import { CardScreen } from './card'
import { EditorScreen } from './editor'

// v0 = 지금 구현 그대로(비교 기준). 지금 registrations 부품에 견본을 넣어 그린다. 고치지 않는다.
// card·empty는 RegistrationTab의 양식 목록(FormReception), editor는 FormEditor와 같은 부품 차례다.
// 서버를 부르지 않는다: 카드의 [설문 링크 활성화]·[멈추기]처럼 지금 부품이 보내는 쓰기는 여기서 막아 실패(503)로 돌려준다.
// 그래서 v0에서 그 버튼을 누르면 지금 구현의 실패 문구가 보인다(그 모습은 비교 대상이 아니다).
const realFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!new URL(url, window.location.href).pathname.startsWith('/api/'))
    return realFetch(input, init)
  console.info('[builder] 서버 호출 막음', url)
  return Promise.resolve(Response.json({ error: 'FAILED' }, { status: 503 }))
}

export default function BuilderV0(props: BuilderProps) {
  if (props.screen === 'editor' && props.data.editor) return <EditorScreen {...props} />
  return <CardScreen {...props} />
}
