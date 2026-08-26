# 교차 검증 2회차: FIN-PROC-01을 명세만 보고 만든다

지난 회차(`cross-check-fin-req-02.md`)가 무엇을 찾았는지부터.

게이트 넷을 그대로 통과했는데도 **통과한 화면의 코드에 명세가 말하지 않은 앎이 일곱
군데 박혀 있었다.** 그중 넷을 스키마로 옮겼고, 그때 알게 된 것이 이것이다.

> **명세가 가리키지 않는 조각은 검증기가 검사할 수 없다.**
> 스무 화면이 `row.statusTone`을 코드에 박아 쓰고 있었는데 아무도 몰랐다.

## 이번 회차가 묻는 것

1회차 뒤로 스키마가 **아홉 군데 늘었다.** 전부 한 손에서 나왔다.

| 새 어휘 | 무엇 |
| --- | --- |
| `screen.breadcrumb` | 제목 위의 현재 위치 경로 |
| `params[].missingNote` | 인자 없이 열렸을 때의 글 |
| `itemList.columns[].toneField` | 딱지의 색 이름이 든 조각 |
| `itemList.columns[].fieldKey` | 열에 오는 것이 읽는 값이 아니라 고치는 칸일 때 |
| `itemList.itemFields` | 서버가 준 항목마다 되풀이되는 묶음 |
| `itemList.fieldKey` | 그 묶음이 모은 값의 이름 |
| `fieldSet` | 칸 목록이 데이터에서 오는 편집 묶음 |
| `button.labelHidden` · `labelWhenAnyItemIs` | 글 없는 조작, 상황에 따라 바뀌는 글 |
| `group.headerFields` | 묶음의 머리에 그려지는 조각 (이번에 생겼다) |

**이번 물음은 이것이다: 이 어휘를 다른 손이 읽고 쓸 수 있는가.**

지은 사람은 늘 자기 어휘를 읽을 수 있다. 그것은 아무것도 말해 주지 않는다.

## 무엇을 만드나

`FIN-PROC-01`(구매·발주 처리) **화면 하나**. 명세는 이미 있고 구현만 없다.

- `specs/figma/vada-wireframe/screens/FIN-PROC-01/screen.json` — 동작 명세
- `specs/figma/vada-wireframe/screens/FIN-PROC-01/figma.design.json` — 디자인의 사실
- `specs/figma/vada-wireframe/screens/FIN-PROC-01/reference.png` — 눈으로 볼 그림
- `specs/figma/vada-wireframe/screens/FIN-PROC-01/assets/` — 그림으로 뽑아 둔 자리

## 무엇을 보고 만드나

**볼 수 있는 것**

| 무엇 | 어디 |
| --- | --- |
| 명세 번들 전부 | `specs/figma/vada-wireframe/` |
| 계약(스키마·판정기·검증기) | `packages/contracts/` |
| 부품 표 | `apps/vada-web/src/components/` · `design/` · `spec/` |
| 이 저장소의 결정 | `docs/decisions/` |
| 와이어프레임 해석 규칙 | `specs/figma/vada-wireframe/interpretation.md` |

**보면 안 되는 것**

- `apps/vada-web/src/screens/` — 이미 만들어 둔 화면 스물셋

같은 종류의 화면이 그 안에 있고, 그것을 보면 **명세가 말하지 않은 것을 거기서
베끼게 된다.** 그러면 이 실험은 아무것도 재지 못한다.

부품 표를 보여주는 이유는 다르다. 현실의 개발자에게도 디자인 시스템은 이미 있고,
없는 것은 **이 화면**이다.

## 만들 것

1. `apps/vada-web/src/screens/FINPROC01Screen.tsx`
2. `apps/vada-web/src/screens/ScreenRouter.tsx`에 한 줄 등록
3. `apps/vada-web/src/spec/screens.ts`에 import·등록(`ALL_SCREENS`에 넣기)
4. 필요하면 `apps/vada-web/src/spec/types.ts`에 타입 추가
   (이 파일은 스키마를 손으로 옮겨 적은 것이다 — `packages/contracts/schemas/`가 원본)
5. 필요하면 부품(`components/`)을 새로 만들거나 넓히기
6. `apps/vada-web/e2e/`에 이 화면의 시나리오 검사

**개발용 응답(fixtures)은 이미 넣어 뒀다.** `apps/vada-web/src/data-sources/fixtures.ts`의
`finance.purchaseOrderSummary`·`finance.purchaseOrders`. 이건 실험의 대상이 아니라
서버 대역이다 — 현실에서는 백엔드가 준다.

## 채점은 사람이 하지 않는다

```
npm test         # 계약 검사 + 화면 검사(준수·design 대조)
npm run validate # 명세 교차 참조
npm run e2e      # 브라우저 시나리오
npm run build
```

게이트가 무엇을 보는지 미리 알아 두면 좋다.

- **준수 검사**(`src/spec/conformance.test.tsx`)는 `ALL_SCREENS`를 훑으므로 등록하는
  순간 채점 대상이 된다.
- **design 대조**(`src/design-check/`)는 `data-node-id`로 등록 노드를 지목하면 그 안의
  **글·글자 색·글자 굵기·칸의 배경색과 테두리색·그림**을 견준다. 여백·크기·위치·글자
  크기는 보지 않는다. **`data-node-id`를 안 달면 "자리 없음"으로 실패한다.**
- **검증기의 역방향 검사**는 design의 상호작용 노드(`Btn`·`Button`·`Text Input`·
  `Dropdown`) 중 등록된 요소 어디에도 없는 것을 오류로 알린다.
- **이동 도착 검사**(`src/spec/navigation-arrival.test.ts`)는 명세의 모든 이동에 대해
  넘어갈 값을 실제로 만들어 보고 대상 화면이 무언가를 집어 오는지 본다.
- **추출기 래칫**(`tests/screen-draft.test.mjs`)은 이 화면을 이미 세고 있다.

## 이 화면에서 처음인 것

정직하게 미리 말해 둔다.

**`group.headerFields`는 이번에 새로 만들었고 이 화면이 첫 사례다.** 다른 화면에서
베낄 곳이 없다. `itemList.group` 자체는 OPS-MEET-01A에 선례가 있지만 거기에는
`columns`가 없어서, **묶음과 열이 함께 오는 것은 이번이 처음이다.**

- `itemList.schema.json`의 `group`에 뜻과 이유가 적혀 있다.
- 묶음이 있으면 `columns`가 가리키는 것이 무엇인지, `headerFields`가 가리키는 것이
  무엇인지가 그 설명의 핵심이다. 둘은 **반대 방향**을 가리킨다.
- 디자인이 묶음 셋을 형제로 두어 **셋을 함께 품는 노드가 없다.** 그래서 요소의
  등록 노드는 첫 묶음이다(`30:1677`). 목록이 하나뿐이라는 뜻이 아니다.

## 지켜야 할 것

`docs/decisions/`에 다 있지만 자주 걸리는 것만 옮겨 적는다.

- **명세에 없는 카피를 지어내지 않는다.** 지어내지 않으려면 적힌 것이 있어야 하고,
  적을 자리가 없으면 그것이 명세의 구멍이다 — 그것을 찾는 것이 이 실험이다.
- **색을 화면 안에 적지 않는다.** 상태 딱지·톤은 `design/tones.ts`가 한 곳에서 갖는다.
  데이터가 주는 것은 색이 아니라 **톤 이름**이다.
- **와이어프레임의 불규칙은 따르지 않는다.** 규칙을 따르고 그래서 생긴 차이는
  `design/deviations.ts`에 적는다. 예외는 자리가 아니라 **규칙·색**에 건다.
- **조용한 대체를 하지 않는다.** 없는 데이터 출처, 등록되지 않은 노드, 인자 없음은
  조용히 넘기지 말고 던지거나 드러낸다.
- 한국어 주석. 무엇을 했는지가 아니라 **왜 그렇게 했는지**를 적는다.

## 끝나고 알려 줄 것

통과/실패보다 **막힌 자리**가 이 실험의 산출물이다.

1. **명세만으로 답이 안 나온 것** — 무엇을 추측해야 했나. 어디서 추측했나.
2. **명세가 틀렸거나 어긋난 것** — 명세와 디자인이 다른 말을 하는 자리.
3. **게이트가 잡아 준 것** — 처음에 몇 곳이 어긋났고 무엇이었나.
4. **부품 표에서 모자란 것** — 새로 만들어야 했던 부품과 그 이유.
5. **명세를 이렇게 적었으면 나았겠다** 싶은 것.

그리고 이번 회차에만 묻는 것 하나:

6. **새 어휘 아홉 중 읽기 어려웠던 것이 있나.** 스키마 설명을 읽고 뜻이 바로
   잡히지 않은 것, 이름이 뜻과 어긋난다고 느낀 것, 두 번 읽어야 했던 것.
   **이름이 나쁘면 지은 사람만 못 느낀다.**

**막힌 자리는 실패가 아니라 이 저장소가 찾고 있는 것이다.** 숨기지 말고 적어 달라.
