// v2 '문서 한 장 모양'의 크기·간격·모서리 이름. 색은 index.css 의미 이름만 쓴다(새 색 없음).
// 근거: Notion 속성 줄(b15)·Notion 폼(b06)·Tally 문서형 편집(b05)·Luma 만들기(b07).
// Tailwind가 글을 읽어 CSS를 만들므로 값은 완성된 클래스 글로 둔다.

// 글자 크기. 카드 화면 넷(20·17·15·13), 편집기 넷(30·17·15·13). 명세 7절 4개 이하.
export const type = {
  // 편집기 맨 위 문서 제목(양식 이름을 그 자리에서 쓴다) 30px
  docTitle: 'text-[30px] leading-[38px] font-bold tracking-[-0.02em]',
  // 양식 카드 제목·빈 상태 제목 20px
  cardTitle: 'text-xl leading-7 font-bold tracking-[-0.01em]',
  // 카드의 상태·신청 수 값(첫눈 초점) 17px
  focus: 'text-[17px] leading-6 font-semibold',
  // 속성 줄 값·이름표, 질문 글, 버튼 15px
  body: 'text-[15px] leading-[22px]',
  // 편집기 선택지 글(학생 화면 선택 줄과 같은 17px)
  choice: 'text-[17px] leading-6',
  // 머리 위 작은 이름표, 잠김 까닭, 구역 이름 13px
  small: 'text-[13px] leading-[19px]',
}

export const size = {
  // 속성 줄 한 줄 최소 높이: 데스크탑 36px(Notion 속성 줄), 터치 44px
  row: 'min-h-9 pointer-coarse:min-h-11',
  // 속성 이름표 칸 폭 152px(아이콘 16 + 간격 8 + '참가비 받을 계좌*'). 390에서는 104px(두 줄까지)
  label: 'w-26 shrink-0 sm:w-38',
  // 누르는 글자 버튼 높이: 데스크탑 32px, 터치 44px
  hit: 'min-h-8 pointer-coarse:min-h-11',
  // 아이콘만 있는 버튼: 데스크탑 32px, 터치 44px
  iconHit: 'size-8 pointer-coarse:size-11',
  // 학생 화면과 같은 회색 채운 칸 높이 56px(신청자 확정안 FilledField)
  filled: 'min-h-14',
  // 페이지 아이콘 타일(Notion 페이지 아이콘): 카드 36px, 편집기 48px
  pageIcon: 'size-9',
  pageIconLarge: 'size-12',
  // 편집기 문서 단 최대 640px, 1280 미리보기 단 300px(휴대폰 390을 0.77배로)
  docColumn: 'max-w-[640px]',
  previewColumn: 'w-[300px]',
  // 카드 문서 한 장 최대 폭 720px(회색 쟁반 가운데)
  sheet: 'max-w-[720px]',
  // 속성 줄 안 작은 QR 48px, 큰 QR 시트 240px
  qrThumb: 'size-12',
  qrLarge: 'size-60',
  // 금액 칸 폭 128px
  amount: 'w-32',
}

// 미리보기: 휴대폰 390 화면을 그대로 그린 뒤 0.77배로 줄여 300px 단에 넣는다. 높이 640px(=실제 831px).
export const preview = {
  frameWidth: 'w-[300px]',
  innerWidth: 'w-[390px]',
  zoom: '[zoom:0.77]',
  height: 'h-[640px]',
}

export const space = {
  // 쟁반 안 여백: 휴대폰 8px, 640 이상 24px
  tray: 'p-2 sm:p-6',
  // 문서 한 장 안 여백
  sheet: 'px-4 py-5 sm:px-8 sm:py-7',
  // 질문 블록 사이 28px(간격으로만 나눈다)
  blocks: 'gap-7',
  // 선택 줄 사이 8px(학생 화면과 같음)
  choices: 'gap-2',
}

export const radius = {
  // 쟁반 20px, 문서 한 장 14px, 학생 칸·선택 줄 14px(신청자 확정안과 같음), 알약 끝까지
  tray: 'rounded-[20px]',
  // 편집기 흰 종이 한 장(데스크탑만 모서리와 선)
  page: 'sm:rounded-[20px] sm:ring-1 sm:ring-border-default',
  sheet: 'rounded-[14px]',
  filled: 'rounded-[14px]',
  pill: 'rounded-full',
  // 휴대폰 미리보기 틀 28px
  phone: 'rounded-[28px]',
}

export const shadow = {
  // 문서 한 장: 선 하나와 아주 옅은 그림자(종이가 쟁반 위에 놓인 느낌, 큰 그림자 피함)
  sheet: 'shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-border-default',
  // 떠 있는 메뉴·시트
  float: 'shadow-lg ring-1 ring-border-default',
}
