import ApplyPage from './ApplyPage'
import MyRegistrationPage from './MyRegistrationPage'
import { mineHref, tokenOfHash, type PublicRoute } from './public-path'

// 로그인 없이 쓰는 화면의 틀. 면·카드 없이 흰 화면 전체이고, 넓은 화면에서는 가운데 520px 흰 단이다(휴대폰 앱 화면을 그대로 가운데에).
// 신청하면 같은 창에서 내 신청으로 간다(주소를 바꿔 뒤로 가기로 신청 칸에 돌아오지 않게 한다).
export default function PublicApp({ route }: { route: PublicRoute }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-130 flex-col bg-white px-6 pt-8 break-keep text-fg">
      {route.kind === 'apply' ? (
        <ApplyPage
          code={route.code}
          onApplied={token => window.location.replace(mineHref(token))}
        />
      ) : (
        <MyRegistrationPage token={tokenOfHash(window.location.hash)} />
      )}
    </main>
  )
}
