---
독자: 에이전트
---

# 013 화면 규칙 강제와 창

> 만들 때의 명세다. 지금의 규칙은 vada-docs `decisions/`와 `navigation.md`, 화면 문구와 폼은 vada `AGENTS.md` '화면 문구와 폼', 동작은 코드가 원문이다(DEC-77).

상한: 6시간(실제로 도는 시간). 시작 2026-10-24 23:46. 양식은 `docs/work-method.md`를 따른다. 가지는 `work/013-조각번호`, 진행 기록은 `.superpowers/sdd/013/progress.md`. 리허설(2026-11-03) 전에 끝낸다(DEC-78 만드는 차례).

## 왜

2026-10-24 점검(`vada-hq/notes/structure-audit/` gap4·gap3·codex-audit 4번)에서 합의한 화면 규칙이 코드에 닿지 않는 곳이 나왔다.

- 폼: 제출 버튼을 칸이 맞을 때만 켜는 곳이 10곳이라, 누르지 못하는 사람은 무엇이 틀렸는지 모른다. 반대로 켜져 있는데 눌러도 아무 일이 없는 곳이 2곳이다(긴 사유가 계약에서 걸리고 글이 없다). 시험 여럿이 꺼진 버튼을 정답으로 굳혔다. 입력칸 예시 글과 예시 안내도 남았다. 규칙을 막는 기계 검사가 없어 새 화면마다 다시 생긴다.
- 확인 창: 공용 부품이 넷(확인, 취소 사유, 다시 열기, 입금 창 틀)으로 갈라졌고, 확인 창은 나가는 버튼이 '취소'로 고정돼 [취소][취소하기]가 나란히 선다(신청 취소, 요청 취소).
- 휴대폰 뒤로 가기: 창과 옆 메뉴가 방문 기록을 쓰지 않아 뒤로 가기가 앱을 닫는다(DEC-78 규칙 4).
- 이력: 업무·지출·수입·요청 상세에 이력이 늘 펼쳐져 감시받는 느낌을 준다. 행사 상세에는 이력이 없다(DEC-80).
- 권한과 운영진 목록: 화면을 연 뒤 다시 읽지 않아, 재정 역할을 받은 부원에게 버튼이 안 생기고 초대로 들어온 사람이 회장의 사람 목록과 1:1 상대 목록에 안 보인다(codex-audit 4번, DEC-38, DEC-47).

### 원칙 대조

- 새로 하는 입력: 없다. 칸 확인은 누를 때로 옮길 뿐 칸이 늘지 않는다. 이력은 메뉴 한 번 뒤로 옮긴다.
- 근거 연결: 바꾸지 않는다.
- 변경 이력: 저장은 그대로이고 보이는 곳만 '⋯' 뒤로 간다(DEC-80, PRIN-3). 고치거나 지우는 길을 만들지 않는다.

## 범위 밖

- 빈 화면 공용 부품(EmptyState·StateMessage·HomeEmpty 합치기)과 날짜 공용 부품(8가지 형식, 날것 ISO): 리허설 뒤.
- 주소 기능(기록 상세 창의 주소, 뒤로=들어온 곳, 새로고침 복원): 016. 이 기능의 창은 주소 없이 기록 한 칸만 쓴다.
- 행사 완료·완료 취소 사유를 완료 상태 옆에 보이기: 012.
- 떠날 때 확인(DEC-78 규칙 10): 뒤로 가기로 쓰던 창이 닫히면 지금 [닫기]처럼 입력이 사라진다.
- 날것 `Label`을 막는 린트, 두 문장 넘는 화면 글 줄이기, 같은 대상 다른 이름 맞추기(gap4): 이번에 고치는 칸만 `Field`로 바꾼다.
- 서버 변경. 표, 계약, 라우트를 바꾸지 않는다.

## 정한 것

| 무엇 | 정한 것 | 근거(주소) | 되돌리기 |
|---|---|---|---|
| 버튼 끄기 막기 | `Button`이 `busy`를 받는다(누를 수 없고 보내는 중임을 읽어 준다). `.oxlintrc.json`의 `react/forbid-component-props`가 `Button`의 `disabled`와 `Input`·`Textarea`의 `placeholder`를, `react/forbid-dom-props`가 날것 요소의 `placeholder`를 막는다. 알림 글은 AGENTS.md '화면 문구와 폼'을 가리킨다. oxlint 1.88.0에서 `disallowedFor`가 도는 것을 확인했다(gap4) | [GOV.UK 버튼: 꺼진 버튼은 피한다](https://design-system.service.gov.uk/components/button/), [oxlint forbid-component-props](https://oxc.rs/docs/guide/usage/linter/rules/react/forbid-component-props), AGENTS.md '화면 문구와 폼' | 쉽다(설정 한 곳) |
| 예외 | 대화 [보내기](빈 메시지일 때 끔)와 지원자 목록 검색칸 안내('이름이나 학번으로 찾기')만 한 줄 끄기(`oxlint-disable-next-line 규칙 -- 이유`)로 둔다. 대화 입력칸의 '메시지' 안내는 예외가 아니라 뺀다(이름은 `aria-label`). 부품 확인 화면의 예시 글 3곳도 뺀다 | AGENTS.md 원문의 예외 둘, [NN/g placeholder](https://www.nngroup.com/articles/form-design-placeholders/) | 쉽다 |
| 누를 수 없던 버튼 | 권한이 없어서 못 하는 동작은 숨긴다(DEC-38). 그 밖(칸이 빔, 바꾼 것 없음, 상한에 닿음)은 켜 두고 누를 때 그 칸 아래(`Field`의 `error`) 또는 버튼 옆에 이유를 보이고 첫 문제 칸으로 옮긴다. 바꾼 것이 없는 [저장]은 그냥 닫는다 | AGENTS.md, GOV.UK error message | 쉽다 |
| 칸 확인 | 모든 폼은 `useFormCheck`로 누를 때 확인하고, 칸 확인이 못 잡는 계약 실패(너무 긴 글)는 `withContract`로 칸 아래에 보인다. 계약이 막았는데 아무 글도 없는 경로를 남기지 않는다 | `lib/use-form-check.ts` 주석, gap4 | 쉽다 |
| 공용 확인 창 | 확인 창은 `components/ConfirmDialog.tsx` 하나다. 칸 없음, 사유 한 칸(꼭/선택), 금액 같은 칸 하나를 받는다. 나가는 버튼은 부품이 '닫기'로 고정하고 바꾸는 속성이 없다. 확인 버튼은 `busy`일 때만 막고, 보내는 동안 창을 닫지 않는다. `CancelReasonDialog`, `ReopenDialog`, 입금 창 틀(`DepositDialogs.tsx`의 `Frame`), `CompletionDialog`의 틀이 이것을 쓴다 | AGENTS.md '창에서 나가는 버튼은 닫기', [NN/g 확인 창](https://www.nngroup.com/articles/confirmation-dialog/) | 보통(약 17곳이 쓴다) |
| 기록을 없애는 동작의 이름 | 확인 버튼은 '○○ 취소'로 대상을 붙인다: 신청 취소, 요청 취소, 지출 취소, 수입 취소, 입금 확인 취소, 완료 취소. '취소하기'를 쓰지 않는다 | AGENTS.md | 쉽다 |
| 휴대폰 칸 안내 | 신청 화면 휴대폰 번호 칸의 '010-1234-5678처럼 써도 돼요.'를 뺀다. 서버는 지금처럼 하이픈을 받는다 | AGENTS.md(예시 글 금지), GOV.UK hint text | 쉽다 |
| 창과 뒤로 가기 | `Dialog`와 `Sheet`가 열릴 때 같은 주소로 기록 한 칸(`history.pushState`, 상태에 창 표시)을 더한다. 뒤로 가기(`popstate`)는 맨 위 창 하나를 닫는다. 창이 다른 길(닫기, X, Esc, 바깥, 저장 뒤 닫힘, 부모가 없앰)로 닫히면 자기 칸을 `history.back()`으로 거둔다. 창 위의 창은 칸을 쌓는다. 보내는 중이라 닫지 않는 창은 뒤로 가기에 칸을 다시 채운다. 메뉴(`Menu`)는 칸을 쓰지 않는다 | DEC-78 규칙 4, [Android 뒤로 원칙](https://developer.android.com/guide/navigation/navigation-principles), [Smashing 2022](https://www.smashingmagazine.com/2022/08/designing-better-back-button-ux/), [Closing dialogs by going back](https://dev.to/maikmichel/closing-dialogs-by-going-back-46pe) | 보통(016이 같은 상태 표시를 이어 써야 한다) |
| 창 기록의 표시 | 상태 객체에 창 표시 한 키만 두고 다른 키는 그대로 둔다(016의 주소 상태와 섞여도 되게). `replaceState(null, …)`를 부르는 곳(`useInviteEntry.ts`, `useChatLink.ts`)은 창이 열리기 전에만 돈다 | DEC-78 '주소 목록은 한 곳' | 보통 |
| [이력 보기] | 업무·지출·수입·요청·행사 상세의 머리에 '⋯' 메뉴를 두고 [이력 보기]를 넣는다. 누르면 상세 위에 '이력' 창(오래된 판부터, 바꾼 사람·시각·바뀐 칸, [닫기])이 열린다. 판 목록을 그리는 창은 공용 표시 부품 하나이고 줄 글은 기능마다의 지금 도우미(`versionLine` 등)가 만든다. 결재 기록(누가 승인·반려했는지, 반려 사유)은 지금 상태를 설명하므로 상세에 남기고 제목을 '결재'로 바꾼다(DEC-80의 완료 사유와 같은 판단) | DEC-80, [Notion ••• > Page history 창](https://www.notion.com/help/guides/tips-to-keep-your-teams-notion-pages-up-to-date), Google Docs 파일 > 버전 기록 | 쉽다 |
| 권한·운영진 갱신 | 학생회 읽기(`useCouncilView`)와 운영진 읽기(`useTeam`)도 다른 목록과 같은 공통 정책(`useVisiblePoll`, 보이는 동안 15초, 화면 복귀 때 바로, 푸시 때 바로)을 쓴다. 받은 값이 지금 값과 같으면 지금 값을 그대로 둔다(다시 그리지 않는다). 1:1 창을 열 때 운영진을 다시 읽는다. 운영진·부서를 바꾼 요청이 성공하면 학생회 읽기를 다시 한다 | codex-audit 4번, [TanStack Query 창 복귀 다시 읽기](https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching), `lib/use-visible-poll.ts` | 쉽다 |

## 위험

- **창 기록(깊게).** 모든 창(약 29파일)이 함께 바뀐다. 잘못되면 뒤로 가기가 두 번 닫거나, 닫은 창의 칸이 남아 뒤로 가기가 헛돌거나, 창이 열리자마자 닫힌다. 특히 개발 모드(StrictMode)의 effect 두 번 실행, `history.back()`이 늦게 부르는 `popstate`가 다음 창을 닫는 경우, 부모가 `open`을 늘 켠 채 창을 없애는 경우(취소 사유 창들)를 시험한다. 열린 창에서 새로고침하면 같은 주소의 칸이 하나 남아 첫 뒤로 가기가 헛돈다. 받아들이고 016에서 다시 본다. Chrome은 사용자가 한 번도 누르지 않은 문서가 더한 칸을 뒤로 버튼에서 건너뛴다([Chromium 문서](https://chromium.googlesource.com/chromium/src/+/127.0.6533.99/docs/history_manipulation_intervention.md)). 알림으로 열자마자 뜬 창이 이 경우다. 기기 확인에서 본다. jsdom 시험은 실제 기기의 뒤로 가기를 증명하지 못한다('닫기' 기기 확인).
- **많은 파일을 건드리는 조각.** 조각 4의 `disabled` → `busy` 바꾸기는 화면 파일 대부분에 닿아 메뉴 작업 폴더의 수정과 부딪친다. 조각 4는 다른 조각과 나란히 하지 않고, 시작 직전에 main을 받아 바로 올린다. 스냅숏은 손으로 고치지 않고 다시 만든다.
- **린트가 못 보는 길.** `<Button {...rest}>`로 넘긴 `disabled`와 다른 이름으로 들여온 `Button`은 규칙이 잡지 못한다. 조각 4가 `Button`에 퍼뜨려 넘기는 곳을 찾아 고친다.
- **다시 읽기와 쓰던 폼.** 15초마다 학생회와 운영진을 다시 읽어도 쓰던 폼의 값, 열린 탭, 고르던 칸이 바뀌지 않아야 한다. 같은 값이면 그대로 두고, 다른 값이어도 폼은 처음 값만 받는다. 고르던 사람이 목록에서 빠지면 고른 값은 남고 보낼 때 서버의 `MEMBER_INVALID` 문구가 보인다(자주 잡힌 것 15). 다시 읽은 권한에서 동작이 빠지면 열린 창은 닫고 이유를 보인다(자주 잡힌 것 1, 지금 `use-lost`의 바깥 변경).
- **서버 부하.** 운영진마다 15초에 두 번 읽기가 는다. 시범 규모에서 받아들인다.
- **와이어프레임.** Figma(`B5OHqrl9bbvXCUkhME4Sfo`)를 보지 못했다. 화면 조각(2, 5)에서 같은 화면 노드와 비교한다.

### 사람이 시작 전에 할 일

없음. 닫을 때의 기기 확인만 사람이 한다.

## 조각

1 → 2 → 3 → 4 차례로 한다(4는 1~3이 고친 파일 위에서 린트를 켠다). 5와 6은 4가 main에 오른 뒤 나란히 해도 된다(파일이 겹치지 않는다). 시간이 모자라면 6을 뺀다(리허설 전 따로 메뉴 작업 폴더에서).

### 1. 뒤로 가기가 창부터 닫기 [ ]
- 할 수 있게 되는 것: 휴대폰과 브라우저의 뒤로 가기가 앱을 떠나지 않고 열린 창이나 옆 메뉴를 닫는다.
- 수용 기준: 어느 창이든 열면 주소는 그대로이고, 뒤로 가기 한 번이면 그 창만 닫히고 아래 화면은 그대로다. [닫기]·X·Esc·바깥 누르기·저장 뒤 닫힘·부모가 창을 없앰으로 닫으면, 그다음 뒤로 가기는 창을 연 적 없을 때와 같은 곳으로 간다(헛도는 칸이 없다). 상세 위에 확인 창을 열면 뒤로 가기 첫 번에 확인 창, 둘째 번에 상세가 닫힌다. 보내는 중인 창은 뒤로 가기에 닫히지 않고, 끝난 뒤의 뒤로 가기가 닫는다. 옆 메뉴(768px 미만)와 대화 링크의 상품 패널도 같다. 메뉴(`Menu`)는 기록을 쓰지 않는다. 개발 모드에서 창을 열면 칸이 하나만 생기고 바로 닫히지 않는다. 공개 신청 화면(`/apply`)의 창도 같다. 창을 닫은 뒤 포커스는 지금처럼 연 버튼으로 돌아간다. 열린 창의 상태 표시를 다른 코드가 지우지 않는다.
- 닿는 곳: `apps/web/src/components/ui/dialog.tsx`, `sheet.tsx`, 새 창 기록 훅(`src/lib`), `auth/useInviteEntry.ts`, `workspace/useChatLink.ts`(확인만), `ui-gallery/`.
- 검토: 깊게(모든 창, 비동기 기록). 마이그레이션: 없음.

### 2. 공용 확인 창과 '닫기' [ ]
- 할 수 있게 되는 것: 모든 확인·사유 창이 같은 모양과 같은 이름으로 열리고, 사유가 틀리면 칸 아래에 이유가 보인다.
- 수용 기준: 확인 창의 나가는 버튼은 모두 '닫기'이고, [취소][취소하기]가 나란한 창이 없다(신청 취소, 요청 취소 창의 확인 버튼은 '신청 취소', '요청 취소'). 사유 칸이 꼭인 창(지출·수입 취소, 결산 다시 열기, 입금 확인 취소, 완료 취소)은 사유에 별표가 있고, 확인 버튼이 늘 켜져 있으며, 비우고 누르면 '…사유를 입력해 주세요'가, 계약 상한보다 길게 쓰고 누르면 칸 아래에 '더 짧게 입력해 주세요'가 보이고 그 칸으로 옮긴다. 둘 다 아무것도 보내지 않는다. 행사 완료의 사유는 '(선택)'이다. 환불 금액 창은 지금 동작 그대로 이 틀을 쓴다. 보내는 동안 두 버튼이 막히고 창이 닫히지 않는다. 서버 오류는 지금처럼 버튼 위에 보인다. 지출·수입 상세에서 창을 여는 버튼도 '지출 취소', '수입 취소'다. `IncomeDetail.test.tsx`, `ExpensesTab.test.tsx`의 꺼진 [취소하기] 시험을 누를 때 확인으로 뒤집는다. 부품 확인 화면에 칸 없음·사유 꼭·사유 선택 세 모양이 있다.
- 닿는 곳: `apps/web/src/components/ConfirmDialog.tsx`, `CancelReasonDialog.tsx`, `finance/ReopenDialog.tsx`, `ExpenseCancelDialog.tsx`, `ExpenseActions.tsx`, `IncomeActions.tsx`, `RequestDetailDialog.tsx`, `registrations/DepositDialogs.tsx`, `events/CompletionDialog.tsx`, `public/MyRegistrationPage.tsx`, 확인 창을 쓰는 나머지(`ConfirmDialog` 사용처 11곳), `ui-gallery/OverlaySections.tsx`.
- 검토: 보통(쓴 `components/ui` 부품의 주석 조건). 마이그레이션: 없음.

### 3. 재정 결재·찾기·고치기의 누를 때 확인 [ ]
- 할 수 있게 되는 것: 재정부가 결재·학생회비 찾기·지출 고치기에서 버튼을 눌러 무엇이 틀렸는지 본다.
- 수용 기준: 요청 결재 줄의 [승인]·[반려 보내기]와 [모두 승인]이 늘 켜져 있고, 금액이나 예산 항목이 비었거나 계약이 받지 않는 값이면 그 줄의 칸 아래에 이유가 보이고 첫 문제 칸으로 옮긴다(아무것도 보내지 않는다). 계약이 받는 금액(0원 포함 여부는 계약대로)이면 보낸다. 반려 사유가 비면 사유 칸 아래에 이유가 보인다. 결재 칸의 날것 라벨은 `Field`다. 학생회비 [찾기]는 늘 켜져 있고, 학번 형식이 아니면 누를 때 칸 아래에 이유가 보인다(쓰는 동안 회색 글을 보이지 않는다). 지출 고치기에서 사유를 계약 상한보다 길게 쓰고 [저장]을 누르면 사유 칸 아래에 이유가 보인다(지금은 아무 일이 없다). 바꾼 것이 없으면 지금처럼 닫힌다. `FinancePage.decisions.test.tsx`, `FeePaymentsTab.test.tsx`의 꺼진 버튼 시험을 누를 때 확인으로 뒤집는다.
- 닿는 곳: `apps/web/src/finance/DecisionRow.tsx`, `DecisionPanel.tsx`, `FeePaymentsTab.tsx`, `ExpenseUpdateDialog.tsx`, 그 시험들.
- 검토: 보통. 마이그레이션: 없음.

### 4. 신청·가입·업무 칸 확인과 린트 켜기 [ ]
- 할 수 있게 되는 것: 남은 꺼진 버튼과 예시 글이 사라지고, 새 코드가 버튼을 끄거나 예시 글을 쓰면 `pnpm check`가 실패한다.
- 수용 기준: 참가 신청 [신청하기], 초대 코드 [초대 코드로 들어가기], 약관 [시작하기], 업무 담당자·행사 고르기 [저장]이 늘 켜져 있고, 누르면 문제 칸(약관은 동의 칸) 아래에 이유가 보이고 그 칸으로 옮긴다. 업무 고르기에서 바꾼 것이 없으면 [저장]이 그냥 닫는다. 품목 [추가]는 상한에 닿으면 누를 때 옆에 이유를 보인다. 부서원 빼기처럼 권한이 없어 못 하는 버튼은 숨긴다. 휴대폰 칸 안내 '010-1234-5678처럼 써도 돼요.'와 대화 입력칸의 '메시지' 안내, 부품 확인 화면의 예시 글이 없다. 대화 [보내기]는 빈 메시지일 때 꺼지고, 지원자 검색칸 안내는 남는다(두 곳만 한 줄 끄기와 이유). 보내는 중인 버튼은 모두 `busy`로 막힌다. `Button`에 `disabled`를, `Input`·`Textarea`·날것 요소에 `placeholder`를 쓰면 린트가 AGENTS.md를 가리키는 글로 실패한다(일부러 넣어 실패하는지 본다). `ApplyPage.test.tsx`, `AgreementGate.test.tsx`의 꺼진 버튼 시험을 뒤집고 `Composer.test.tsx`는 그대로 통과한다. AGENTS.md '화면 문구와 폼'의 제출 버튼 줄에 "린트가 막는다, 보내는 중은 `busy`" 한 마디를 더한다.
- 닿는 곳: `.oxlintrc.json`, `apps/web/src/components/ui/button.tsx`, `public/ApplyFields.tsx`, `councils/NoCouncil.tsx`, `auth/AgreementPanel.tsx`, `tasks/TaskPickerRow.tsx`, `finance/RequestCreateDialog.tsx`, `team/MemberDepartmentList.tsx`, `finance/EvidenceAdder.tsx`, `chat/Composer.tsx`, `registrations/ApplicantList.tsx`, `ui-gallery/FormSections.tsx`·`OverlaySections.tsx`, `Button`의 `disabled`를 쓰는 모든 화면 파일(이름 바꾸기), `AGENTS.md`.
- 검토: 보통. 마이그레이션: 없음.

### 5. [이력 보기] [ ]
- 할 수 있게 되는 것: 운영진이 상세 화면에서 이력을 늘 보지 않고, 필요할 때 '⋯' > [이력 보기]로 연다.
- 수용 기준: 업무·지출·수입·요청 상세와 행사 상세에 이력 묶음이 펼쳐져 있지 않다. 각 상세의 머리에 '⋯'(이름 '더 보기')가 있고 그 안에 [이력 보기]가 있다. 누르면 '이력' 창이 상세 위에 열리고 오래된 판부터 모든 판(바꾼 사람·시각·바뀐 칸, 사라진 사람은 DEC-54대로)이 보이며, 뒤로 가기 첫 번에 이력 창만 닫힌다(조각 1). 행사 상세의 이력은 행사 상세 응답의 `history`를 쓴다(만듦, 이름·일시·장소·담당 바뀜). 상세를 볼 수 있는 사람은 모두 이력을 본다. 요청·지출의 결재 기록은 상세에 남고 제목이 '결재'다. 이력 창에 고치기·지우기가 없다. 390px에서 가로 넘침이 없다.
- 닿는 곳: 새 공용 이력 창 부품(`src/components`), `tasks/TaskDetailDialog.tsx`·`TaskHistory.tsx`, `finance/ExpenseDetailDialog.tsx`·`ExpenseFacts.tsx`, `IncomeDetailDialog.tsx`·`IncomeFacts.tsx`, `RequestDetailDialog.tsx`·`RequestRecords.tsx`, `events/EventHeader.tsx`, contracts `EventVersion`(읽기만), `ui-gallery/`.
- 검토: 보통(부품 주석 조건). 마이그레이션: 없음.

### 6. 권한과 운영진 목록 다시 읽기 [ ]
- 할 수 있게 되는 것: 다른 사람이 바꾼 내 권한과 새로 들어온 운영진이 화면을 다시 열지 않아도 보인다.
- 수용 기준: 회장단이 부원에게 재정 역할을 주면, 그 부원의 화면이 보이는 동안 15초 안에(앱으로 돌아오면 바로) 재정 관리 버튼과 결재 대기가 보인다. 역할을 빼면 버튼이 사라지고 열려 있던 관리 창은 닫히며 이유가 보인다. 초대 링크로 누가 들어오면 회장의 사람 목록과 1:1 상대 목록에 15초 안에 보이고, 1:1 창을 열면 바로 다시 읽는다. 내가 운영진·부서를 바꾼 요청이 성공하면 학생회를 다시 읽는다. 화면이 숨으면 읽지 않는다. 다시 읽은 값이 같으면 열린 탭, 거르기, 쓰던 폼, 고르던 칸이 그대로다(값이 같은데 다시 그리지 않는 것을 시험한다). 다시 읽다 실패하면 보던 것을 그대로 둔다. 시험은 두 사용자 흐름으로 둔다: 처음에 권한 없는 응답으로 열고, 다음 읽기에 권한을 주면 버튼이 생긴다. 다시 읽기를 끊으면 시험이 실패한다(자주 잡힌 것 14).
- 닿는 곳: `apps/web/src/workspace/useCouncilView.ts`, `useCouncilData.ts`, `team/useTeam.ts`, `team/People.tsx`, `chat/DirectDialog.tsx`, `lib/use-visible-poll.ts`(쓰기만), `workspace/CouncilWorkspace.finance.test.tsx`.
- 검토: 보통(권한은 서버가 다시 본다, codex-audit 4번). 마이그레이션: 없음.

## 닫기

마지막 조각을 배포한 뒤 진행 에이전트가 사람에게 아래 기기 확인을 맡기고, 결과(날짜, 기기, OS, 브라우저, 단계마다 됨·안 됨)를 `docs/device-checks.md`의 새 절 '창과 뒤로 가기'에 옮긴다. A는 갤럭시 Chrome(회장), B는 아이폰 홈 화면 앱(부원).

1. A가 업무 상세를 열고 기기 뒤로 가기 → 상세만 닫힌다. 상세 → '⋯' > [이력 보기] → 뒤로 두 번 → 이력, 상세 순서로 닫히고 앱은 그대로다. 옆 메뉴를 열고 뒤로 → 메뉴만 닫힌다.
2. A가 지출 취소 창에서 [닫기] 뒤 뒤로 가기 → 창을 열기 전과 같은 곳으로 간다.
3. B가 화면 왼쪽에서 밀어 뒤로(Safari 탭과 홈 화면 앱 각각) → 창이 닫힌다.
4. A가 B에게 재정 역할을 준다 → B가 앱을 내렸다 다시 열면 재정 관리 버튼이 보인다.
5. 새 사람이 초대 링크로 들어온다 → A의 사람 목록과 1:1 상대 목록에 보인다.

지표와 회고 세 줄은 이 아래에 적는다.
