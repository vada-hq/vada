// 양식 카드·편집기('문서 한 장 모양', 대표 확정 시안 v2 refined)의 글자·크기·모서리. 색은 index.css 의미 이름만 쓴다.
// 근거: Notion 속성 줄·Notion 폼·Tally 문서형 편집·Luma 만들기(notes/integration/events/form-builder-v2.md).
// 시안 값(30/28/20/15/13px, 모서리 14·20·28px)을 Tailwind 스케일과 index.css 글자·모서리 단계로 옮겼다.
// Tailwind가 글을 읽어 CSS를 만들므로 값은 완성된 클래스 글로 둔다.

// 글자 단계: 편집기 양식 이름·카드 큰 수 30 / 카드 제목 20 / 속성 줄·질문·버튼 15 / 작은 이름표·잠김 까닭 12
export const type = {
  docTitle: 'text-3xl font-bold tracking-tight',
  count: 'text-3xl/9 font-bold tracking-tight',
  cardTitle: 'text-xl/7 font-bold tracking-tight',
  body: 'text-row-sub',
  // 입력칸 글: 640 미만은 16px(iOS가 16px보다 작은 칸에 초점이 가면 화면을 확대한다, components/ui/input 주석)
  input: 'text-base sm:text-row-sub',
  small: 'text-xs/5',
}

export const size = {
  // 속성 줄 한 줄 최소 높이: 데스크탑 36px(Notion 속성 줄), 터치 44px
  row: 'min-h-9 pointer-coarse:min-h-11',
  // 속성 이름표 칸 폭: 390은 104px(두 줄까지 감김), 640 이상 152px
  label: 'w-26 shrink-0 sm:w-38',
  // 글자 버튼: 데스크탑 32px, 터치 44px
  hit: 'min-h-8 pointer-coarse:min-h-11',
  iconHit: 'size-8 pointer-coarse:size-11',
  // 선택지 알약: 데스크탑 32px, 터치 44px
  chip: 'min-h-8 pointer-coarse:min-h-11',
}

// 고칠 수 있는 값: 쉴 때 바탕 없이 글만, 올리면 옅은 면, 고치는 중 흰 바탕과 파란 고리(키보드 초점도), 틀리면 빨간 고리.
// 대표 지적(10/30): 늘 깔린 회색 칸이 많아 못생김 → 노션식. 부품(Input 등)의 테두리·높이를 이 클래스로 덮는다.
export const fieldSurface =
  'h-auto rounded-lg border-0 bg-transparent shadow-none outline-none hover:bg-surface-muted focus:bg-white focus:ring-2 focus:ring-primary-emphasis focus-visible:ring-2 focus-visible:ring-primary-emphasis aria-invalid:bg-white aria-invalid:ring-2 aria-invalid:ring-danger-emphasis read-only:bg-transparent'

// 흰 종이 한 장: 선 하나와 아주 옅은 그림자(큰 그림자 피함)
export const sheet = 'rounded-2xl bg-white shadow-xs ring-1 ring-border-default'
