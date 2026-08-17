# vada 구현 관례

vada 제품의 wireframe 원본을 제품 코드로 옮길 때 적용하는 **제품 스코프** 관례다. 제품 무관 방법론은 `implementation-methodology.md`, 특정 wireframe 원본을 읽는 법은 해당 wireframe 폴더의 `specs/figma/<wireframeKey>/interpretation.md`에 있다. (2026-08-17 확정)

## 0. 위치와 스택

- 앱은 `apps/vada-web`이다.
- Vite + React + TypeScript + Tailwind CSS v4 + lucide-react. 와이어프레임 수치가 Tailwind 파생 값이라 토큰 복원이 1:1이고, 식별된 아이콘이 lucide이기 때문이다.

## 1. 치수: 캡처 아티팩트를 복제하지 않는다

- 디자인 수치는 wireframe의 캡처 스케일을 해제한 뒤 가장 가까운 표준 값(4px 그리드·Tailwind 스케일)으로 스냅해 구현한다. 스케일 값은 각 wireframe의 `interpretation.md`에 있다.
- 환산이 정수로 떨어지지 않는 값은 구성 요소 합(패딩+행간+테두리)으로 역산해 표준 조합으로 정한다.
- `reference.png`는 레이아웃 구조·순서·정렬·상대 비율의 검증 기준으로 쓴다. 절대 픽셀 일치는 요구하지 않는다.

## 2. 아이콘: 라이브러리 직접 사용

- 식별된 아이콘은 원본 라이브러리(현재까지는 lucide)를 직접 사용한다. 크기·stroke는 환산 후 표준값, 색은 `currentColor`로 상태에 따라 바꾼다.
- `specs/figma/<wireframeKey>/screens/<screenId>/assets/*.svg`는 구현용 자산이 아니라 추출 검증 증거물이다(색 하드코딩, 축소 스케일).
- 화면별 아이콘 식별 결과는 해당 wireframe의 `interpretation.md`에 기록한다.

## 3. 폰트: Pretendard

- 본문과 UI 전체에 Pretendard(가변 폰트, CDN 로드)를 사용한다.
- 폴백 스택: `Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif`.
- wireframe에 기록된 폰트명은 캡처 아티팩트일 수 있다. `interpretation.md`의 판정을 따르고 크기·굵기 위계만 신뢰한다.

## 4. 반응형: 유동 대응

- 고정폭을 두지 않는다. 주요 컨테이너는 환산된 max-width를 갖고 좁은 화면에서는 좌우 여백만 남기고 자연 축소되는 유동 레이아웃으로 만든다.
- 별도 모바일 레이아웃 재설계는 하지 않는다.

## 5. 색상: 시맨틱 토큰으로 매핑

- 디자인 문서의 hex를 코드에 직접 흩뿌리지 않는다. 팔레트와 일치하는 값은 시맨틱 토큰으로 매핑하며, wireframe별 매핑표는 `interpretation.md`에 둔다.
- placeholder 색은 gray-400으로 통일한다. 원본이 placeholder를 값 색으로 그렸더라도 따르지 않는다.

## 6. 상태 시각: 구현 관례로 보충

- wireframe에 없는 상태는 관례로 보충한다. focus는 테두리 강조와 ring, error는 red 계열 테두리와 메시지, disabled는 배경 gray-100·텍스트 gray-400.
