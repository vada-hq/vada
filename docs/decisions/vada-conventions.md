# vada 구현 관례

vada 제품의 wireframe 원본을 제품 코드로 옮길 때 적용하는 **제품 스코프** 관례다. 제품 무관 방법론은 `implementation-methodology.md`, 특정 wireframe 원본을 읽는 법은 해당 wireframe 폴더의 `specs/figma/<wireframeKey>/interpretation.md`에 있다. (2026-08-17 확정)

**우선순위**: 디자인 문서에 실제로 그려진 사실은 아래 관례보다 우선한다. 관례는 원본에 없는 것을 보충할 때만 적용한다(예: 비활성 배경은 관례상 gray-100이지만 wireframe이 gray-50으로 그렸으므로 gray-50).

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

## 7. 공통 UI 상태

- 선택 목록의 상태(idle/loading/empty/error)는 **목록 패널 안**에 카탈로그 `messages` 문구를 그대로 텍스트로 표시한다. loading에는 lucide `Loader2` 회전 아이콘을 병기한다.
- **화면과 블록의 loading은 글이 아니라 회색 블록(스켈레톤)이다**(2026-09-06 사람이 정함). 와이어프레임에 로딩 화면이 없어 표현을 구현이 정한다. 채워질 자리의 모양대로 `animate-pulse` 블록을 띄우고, 카탈로그의 `loading` 문구는 `aria-label`로 남긴다 — 눈에는 모양이, 읽어 주는 기계에는 그 글이 간다. 기다리는 자리는 **블록 단위**다(`Built`); 자리마다 두르지 않은 화면만 셸 모양의 전체 스켈레톤으로 기다린다.
- 목록 패널은 흰 배경, border gray-200, rounded-md, shadow-md로 그리고, 항목 hover는 gray-50, 선택된 항목은 blue-600 medium으로 표시한다(와이어프레임에 열린 상태가 없어 관례로 정함).
- 필드 오류는 **필드 아래 인라인**으로 red-500 텍스트를 표시하고 해당 필드 테두리를 red-500으로 바꾼다. 필수 누락 문구는 `"필수 항목입니다"`로 통일한다.
- 버튼 차단(`showMissingRequiredFields`)의 구현 형태: 판정기의 `missingFieldKeys` 전부에 인라인 오류를 표시하고, `firstMissingField`(화면 순서상 첫 누락)로 포커스와 스크롤을 이동한다.
- 개발 mock에는 300~600ms 인위 지연을 둬 로딩 상태를 실제로 확인할 수 있게 한다.
- 검색·선택 콤보박스의 키보드 조작: ArrowDown/ArrowUp으로 하이라이트 이동(닫혀 있으면 열기), Enter로 선택, Escape로 닫기. 포커스가 컴포넌트를 떠나면 패널을 닫고, 하이라이트는 `aria-activedescendant`로 노출한다.
- select 값을 상태에 저장할 때 표시 라벨을 함께 보관한다. 값(id)만으로는 재방문 시 라벨을 복원할 수 없다.

## 8. 컴포넌트 구조

- 화면은 조립만 한다. 요소 유형(input/select/button)은 `apps/vada-web/src/components/`의 공통 컴포넌트로 구현하고, 첫 화면에서 태어난 컴포넌트가 이후 화면의 기반이 된다.
- 공통 컴포넌트의 props 계약은 동작 명세의 스키마 필드(`fieldKey`, `label`, `placeholder`, `required`, `initiallyDisabled`, `searchable`, `enabledWhen`, `resetOnChangeOf`…)에서 출발한다.
- 버튼 실행 판정은 재구현하지 않고 `packages/contracts/src/button-execution.mjs`를 직접 import해 단일 의미론을 유지한다.
