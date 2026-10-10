import ApplyPage from './ApplyPage'
import type { PublicRoute } from './public-route'

// 로그인 없이 쓰는 화면. 주소에 따라 공개 신청 화면이나 내 신청 화면을 그린다(내 신청은 다음 작업에서 채운다).
export default function PublicApp({ route }: { route: PublicRoute }) {
  return route.kind === 'apply' ? <ApplyPage code={route.code} /> : <main data-route={route.kind} />
}
