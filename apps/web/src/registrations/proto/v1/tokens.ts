// v1 '카드 더미 모양'의 크기·간격·모서리·그림자 이름. 색은 index.css 의미 이름만 쓴다(새 색 없음).
// 근거: 구글폼 편집기(b01: 흰 카드 쌓기, 펼친 카드 왼쪽 강조 줄, 떠 있는 세로 도구 막대),
// Shopify 설정 안내(b13: 'n개 중 m개 끝남' + 체크 줄), GitHub 병합 상자(b14: 막힌 이유 한 문장).
// Tailwind가 이 파일의 글을 읽어 CSS를 만들므로 값은 완성된 클래스 글로 둔다.

// 글자 크기 네 단계(명세 7절: 4개 이하). 입력칸 글자는 앱 부품 그대로(데스크탑 14, 휴대폰 16).
export const type = {
  // 양식 카드의 신청 수 28px(1순위 숫자)
  count: 'text-[28px] leading-8 font-bold tracking-[-0.02em]',
  // 양식 이름·편집기 제목 18px
  head: 'text-lg leading-6 font-semibold',
  // 카드 제목·줄 글·버튼 14px
  body: 'text-sm',
  // 요약·알약·보조 글 12px
  small: 'text-xs',
}

export const space = {
  // 쟁반 안쪽 여백: 390 12px, 1280 20px
  tray: 'p-3 sm:p-5',
  // 카드 사이 12px(구글폼 카드 간격)
  stack: 'gap-3',
  // 카드 안 좌우 여백: 390 16px, 1280 20px
  cardX: 'px-4 sm:px-5',
  // 펼친 카드 안 칸 사이 20px
  fields: 'gap-5',
  // 편집 단과 미리보기 단 사이 52px(가운데에 44px 도구 막대가 양옆 4px 띄워 들어간다)
  columns: 'lg:gap-13',
}

export const size = {
  // 1280 미리보기 단 폭 396px(휴대폰 틀 바깥 폭). 안쪽 화면 약 382px: 아이폰 375 이상이라 확정안 선택지 넷이 한 줄에 든다
  previewCol: 'lg:grid-cols-[minmax(0,1fr)_396px]',
  // 휴대폰 화면 높이 640px(1280×800 첫 화면 안에 거의 다 든다)
  phoneScreen: 'h-160',
  // 접힌 카드 한 줄 높이 최소 60px(누르는 줄)
  foldRow: 'min-h-15',
  // 양식 카드 윗변 상태 띠 4px
  band: 'h-1',
  // 펼친 카드 왼쪽 강조 줄 4px
  accent: 'w-1',
  // 아이콘 원 36px(회장단 홈 이유 아이콘 원과 같은 가족)
  iconCircle: 'size-9',
  // 체크 줄 머리의 상태 원 22px
  checkMark: 'size-5.5',
  // 양식 카드 QR 썸네일 한 변 76px(흰 바탕, 여백 포함)
  qrThumb: 'size-19',
  // QR 시트 안 QR 한 변 240px
  qrSheet: 'size-60',
  // 떠 있는 도구 막대 폭 44px
  toolbar: 'w-11',
  // 휴대폰 누르는 대상 44px
  touch: 'max-sm:min-h-11',
  touchSquare: 'max-sm:min-h-11 max-sm:min-w-11',
}

export const radius = {
  // 쟁반 16px
  tray: 'rounded-2xl',
  // 카드 12px(refs 2.1)
  card: 'rounded-xl',
  // 링크 줄 면·계좌 고르기 줄 10px
  inner: 'rounded-[10px]',
  // 휴대폰 틀 바깥 32px, 화면 24px
  phone: 'rounded-[32px]',
  phoneScreen: 'rounded-3xl',
  // 알약
  pill: 'rounded-full',
}

export const shadow = {
  // 카드: 아주 옅은 한 겹(큰 그림자는 '피할 느낌')
  card: 'shadow-xs',
  // 펼친 카드·도구 막대: 한 단계 진하게 떠 보이게
  raised: 'shadow-sm',
  // 휴대폰 틀
  phone: 'shadow-lg',
}

// 복사 알림이 떠 있는 시간(ms, Material snackbar 짧은 알림)
export const TOAST_MS = 2000
