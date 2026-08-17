# 프론트엔드 구현 해석 규칙

와이어프레임(`vada-wireframe`)에서 추출한 `figma.design.json`을 제품 코드로 옮길 때 적용하는 확정 규칙이다. (2026-08-17 확정)

## 1. 치수: ÷0.875 환산 후 표준 스케일로 스냅

- `figma.design.json`의 수치는 통상 웹 값의 0.875배로 캡처된 아티팩트다(448=512×0.875, fontSize 12.25=14×0.875, 5.25=6×0.875).
- 구현은 값을 0.875로 나눠 환산한 뒤 가장 가까운 표준 값(4px 그리드·Tailwind 스케일)으로 스냅한다. 0.875배 값을 그대로 복제하지 않는다.
- 환산이 정수로 떨어지지 않는 값(예: 입력 높이 33.5→38.29)은 구성 요소 합(패딩+행간+테두리)으로 역산해 표준 조합으로 정한다.
- `reference.png`는 레이아웃 구조·순서·정렬·상대 비율의 검증 기준으로 쓴다. 절대 픽셀은 환산 때문에 1/0.875배가 되므로 픽셀 단위 일치는 요구하지 않는다.

## 2. 아이콘: lucide 직접 사용

- ONB-01의 벡터 11개는 Search ×3, ChevronDown ×3, ArrowRight ×1로 식별됐다(stroke 1.167 = lucide 기본 2px의 14px 환산).
- 구현은 lucide 계열 패키지를 직접 사용한다. 크기 16px(14÷0.875), stroke 기본 2px, 색은 `currentColor`로 상태에 따라 바꾼다.
- `specs/figma/<wireframeKey>/screens/<screenId>/assets/*.svg`는 구현용 자산이 아니라 추출 검증 증거물이다(색 하드코딩, 축소 스케일).

## 3. 폰트: Pretendard

- 본문과 UI 전체에 Pretendard(가변 폰트 권장)를 사용한다.
- 폴백 스택: `Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif`.
- `figma.design.json`의 `"Inter"`는 한글 글리프가 없어 폴백으로 렌더된 캡처 아티팩트이므로 폰트명은 무시하고 크기·굵기 위계만 따른다.

## 4. 반응형: 유동 대응

- 데스크톱 1288 기준으로 구현하되 고정폭을 두지 않는다. 카드 최대 폭 512px(448÷0.875), 좁은 화면에서는 좌우 여백만 남기고 자연 축소되는 유동 레이아웃으로 만든다.
- 별도 모바일 레이아웃 재설계는 하지 않는다. 입력과 버튼은 카드 폭 100%라 그대로 동작한다.

## 5. 색상: 시맨틱 토큰으로 매핑

- `figma.design.json`의 hex를 코드에 직접 흩뿌리지 않는다. Tailwind 팔레트와 일치하는 값은 토큰으로 매핑한다(#99A1AF=gray-400, #1E2939=gray-800, #F9FAFB=gray-50 등).
- placeholder 색은 gray-400(#99A1AF)으로 통일한다. 와이어프레임에서 placeholder가 값 색(#1E2939)으로 그려진 것은 원본 결함으로 보고 따르지 않는다.

## 6. 상태 시각: 구현 관례로 보충

- 와이어프레임에 없는 상태는 관례로 보충한다. focus는 테두리 강조와 ring, error는 red 계열 테두리와 메시지, disabled는 배경 gray-100·텍스트 gray-400(단과대학·학부·학과의 비활성 모습과 일치).
- 현재 학년 `Dropdown`(7:75)은 자식 없는 빈 프레임이므로 다른 입력과 동일한 스타일로 구현한다.
