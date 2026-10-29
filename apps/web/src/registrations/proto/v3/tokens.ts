// v3 '설정 줄과 무대 모양'의 크기·모서리·그림자. 색은 index.css 의미 이름만 쓴다(새 hex 없음).
// Tailwind가 클래스를 찾도록 클래스 글 전체를 그대로 적는다.

// 편집기: 왼쪽 흰 설정 단(420px) + 오른쪽 회색 무대(남은 폭). 1024px 이상에서 둘로 나눈다.
export const SPLIT = 'lg:grid-cols-[420px_minmax(0,1fr)]'
// 편집기 높이(1024px 이상): 휴대폰 틀(720+테) + 위 바꿈 알약 줄 + 위아래 여백. 설정 단은 이 안에서 스크롤하고 [만들기]는 단 맨 아래에 늘 보인다.
export const EDITOR_H = 'lg:h-[880px]'
// 휴대폰 틀: 화면 폭 390 + 테 12×2 + 선. 무대가 좁으면 줄어든다.
export const PHONE_W = 'w-full max-w-[416px]'
export const PHONE_RADIUS = 'rounded-[44px]'
export const PHONE_SCREEN_RADIUS = 'rounded-[32px]'
export const PHONE_SCREEN_H = 'h-[720px]'
// 컴퓨터 틀(브라우저 창): 무대 폭을 채우되 560까지
export const DESK_W = 'w-full max-w-[560px]'
export const DESK_SCREEN_H = 'h-[700px]'
// 틀 그림자: 무대 위에 뜬 기기(작고 옅게, 마케팅 그림자 피함)
export const DEVICE_SHADOW = 'shadow-[0_8px_24px_-12px_rgb(16_24_40/0.25)]'

// 양식 카드: 회색 쟁반 안 흰 묶음, 오른쪽 QR 칸 폭
export const QR_COL = 'md:grid-cols-[minmax(0,1fr)_248px]'
export const TRAY_RADIUS = 'rounded-2xl'
export const BUNDLE_RADIUS = 'rounded-xl'
// QR 그림 160px(포스터용, 여백 포함)
export const QR_SIZE = 'size-40'

// 구역 줄 아이콘 원 32px, 상태 원 24px
export const ICON_CIRCLE = 'size-8'
export const STATE_CIRCLE = 'size-6'

// 신청 수 큰 숫자 36px(카드에서 숫자는 이것 하나)
export const BIG_NUMBER = 'text-4xl'
