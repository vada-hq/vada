---
독자: 에이전트
---

# 019 공지

> 취소(2026-10-25): 만들지 않는다. 기획자와 논의해 공지는 와이어프레임대로 하기로 했고, 이 명세가 따르던 DEC-86은 폐기됐다. 아래는 기록으로만 남긴다.

> 만들 때의 명세다. 지금의 규칙은 vada-docs `decisions/`와 `logical-model.md`, 동작은 코드가 원문이다(DEC-77).

상한: 6시간(실제로 도는 시간). 시작 2026-10-25 14:51. 양식은 `docs/work-method.md`를 따른다. 가지는 `work/019-조각번호`, 진행 기록은 `.superpowers/sdd/019/progress.md`.

## 왜

지금 공지는 운영진 전체방 메시지에 붙는 표시(`message.is_notice`, DEC-14, DEC-48, DEC-59, RULE-31)라 메시지만 공지가 되고, 모아 보는 곳이 대화 안(방 목록 맨 위의 공지 칸, 전체방 위의 띠, 모아 보기)이다. 홈에서는 회장단이 아닌 운영진만 7일 안의 메시지 첫 줄을 본다(DEC-76). 주인 결정(2026-10-25): 공지는 "지금 학생회 운영진 모두가 알거나 인지해야 하는 정보"이고 메시지만이 아니라 일정(행사), 회의록, 공문, 사진, 행사 중 급한 변경일 수 있다. 공지의 자리는 홈이고, 원래 기록 옆의 '공지로 올리기'로 만든다. 이 기능은 공지를 여러 종류의 기록을 가리키는 기록으로 바꾸고, 홈 맨 위에 모든 운영진에게 보이게 한다.

- 근거: DEC-14(대체), DEC-48(같은 기수의 공지는 들어오기 전 것도 본다, 공지 정의만 바뀜), DEC-59(남의 글도 공지로, 모아 보기는 볼 수 있는 것만), DEC-76(홈의 공지 부분, 일부 대체), DEC-82·RULE-41(공지는 업무 결과물), DEC-28(공지는 회장단), DEC-38(화면은 권한을 다시 셈하지 않는다), PRIN-1, PRIN-5.
- 이미 있는 것: 서버 `apps/api/src/chat/notice.ts`(`markNotice`), `chat/send.ts`(`notice: true`로 보내기, 015), `chat/messages.ts`(`shownNotice`, `visibleMessage`, `noticesOf`), `chat/plan-room.ts`(`inNoticeRoom`), `chat/stage.ts`(공지의 결과물 단계), `tasks/result-sync.ts`(기록 쓰기 고리), 권한 `chat.notice`(회장단). 화면 `home/NoticesSection.tsx`·`home-view.ts`(`recentNotices`, 7일), `chat/NoticeEntry.tsx`·`NoticeBand.tsx`·`NoticePage.tsx`·`useNotices.ts`·`notice-seen.ts`(기기에 저장한 본 시각)·`useNoticeMark.ts`·`useMessageActions.ts`('공지로 표시'·'공지 해제'), `tasks/NoticeMakeDialog.tsx`(업무에서 전체방에 공지 보내기). 주소 `/chat/:c?tab=notices`(`packages/contracts/src/paths.ts`). 알림 기록 종류 `created`(표에 이미 있음), 휴대폰 알림 보내기(`push/fanout.ts`).

### 원칙 대조

- 새로 하는 입력: 없다. 공지는 이미 있는 기록(전체방 메시지, 행사) 옆의 '공지로 올리기' 한 번이다. 제목, 기간, 대상을 따로 받지 않는다(제목은 대상에서, 기간은 정해진 7일). 올리는 회장단에게는 카톡 공지방에 다시 쓰던 일이 버튼 하나로 줄어 바로 이득이고, 받는 운영진은 아무것도 하지 않고 홈 맨 위와 휴대폰 알림으로 안다(PRIN-1).
- 근거 연결: 공지는 내용을 복사하지 않고 원래 기록을 가리킨다. 홈과 모아 보기의 줄은 그 기록의 지금 값을 보이고 원래 자리로 연다.
- 변경 이력: 공지는 기록(`record`)이라 올린 사람·시각이 판 1에, 내린 사람·시각이 다음 판에 남는다. 내린 뒤 다시 올리면 새 공지다. 기존 공지 표시는 옮길 때 올린 사람·시각을 판에서 가져온다.
- 원문의 권한(PRIN-5): 메시지는 전체방 것만 공지가 된다. 부서방·회장단방 글을 공지로 올리면 원래 보지 못하던 사람에게 내용이 열리기 때문이다. 행사는 원래 모든 운영진이 본다.

## 범위 밖

- 회의록·문서·투표·신청 양식·업무·구매 요청·대화 밖 파일(PDF 공문)을 가리키는 공지. 이 화면들이 생기면 대상 종류에 더한다(공문은 지금 전체방 사진 메시지로 올린다).
- 부서방·회장단방·행사방 메시지를 공지로 올리기, 회장단 밖의 사람이 공지 올리기, 공지마다 기간 고르기, 따로 쓰는 한 줄 제목, 대상 고르기(부서만 보기), 읽음 확인·본 사람 목록·안 본 사람 다시 알리기, 사람마다 공지 숨기기(닫기), 메시지로 바로 가기(전체방 안의 그 메시지 위치).
- `message.is_notice` 칸 지우기: 마지막 조각이 배포된 뒤 따로 만든다(AGENTS.md '마이그레이션'). 진행이 제안 이슈로 남긴다.
- 기수 넘기기에서 공지를 넘기는 법(DEC-48 결과, RFC-6).

## 정한 것

| 무엇 | 정한 것 | 근거(주소) | 되돌리기 |
|---|---|---|---|
| 공지의 모양(주인) | 공지는 기록 종류 `notice`이고 대상 기록 하나를 가리킨다(대상 번호, 대상 종류, 내린 시각). 올린 사람·시각은 기록의 만든 사람·시각이다. 내용을 복사하지 않는다 | 주인 결정, [Microsoft Teams 공지 게시물](https://support.microsoft.com/topic/483ec887-188a-4e18-8551-0c4fe691ffff), [Workplace Key Updates(글 하나를 공지로 표시)](https://www.workplace.com/features/key-updates), AGENTS.md '마이그레이션'(엔티티는 기록의 하위 표, 여러 종류를 가리키는 칸은 `(대상 id, 대상 kind)` 외래 키와 허용 종류 CHECK) | 어렵다(운영 DB 표) |
| 대상 종류 | 이번에는 `message`(운영진 전체방 것만)와 `event` 둘. 다른 종류는 허용 종류 CHECK를 넓혀 더한다 | 지금 화면이 있는 것만(지시), PRIN-5. 넓히기는 0013처럼 CHECK 하나 | 쉽다(넓히기) |
| 누가 | 올리기·내리기는 회장단(지금 `chat.notice`와 같은 사람). 권한 키 이름을 `notice.manage`로 바꾸고 `chat.notice`는 지운다. 회장단은 남이 올린 공지도 내린다 | DEC-28, DEC-59, [네이버웍스 공지 작성 권한을 관리자·마스터로 제한](https://help.worksmobile.com/ko/use-guides/board/post/set-post-as-notice/), [Viva 공지는 편집 권한자만](https://learn.microsoft.com/viva/connections/announcements-viva-connections) | 쉽다 |
| 보이는 기간 | 올린 뒤 7일(7×24시간) 동안 '지금 공지'이고 저절로 지난 공지가 된다. 회장단은 언제든 [공지 내리기]로 바로 내린다. 기간은 고르지 않는다. 7은 contracts 상수 하나 | [Workplace Key Updates: 피드 맨 위 7일](https://www.workplace.com/features/key-updates), DEC-76(홈 공지 7일), [Viva는 끝 날짜를 고름](https://learn.microsoft.com/viva/connections/announcements-viva-connections). 새 입력이 없는 쪽 | 쉽다(값 하나) |
| 같은 대상 | 한 대상의 지금 공지는 하나다. 지금 공지인 대상을 다시 올리면 그 공지를 그대로 돌려준다(판 없음). 지났거나 내린 대상을 다시 올리면 새 공지다. 학생회 행을 잠근 거래 안에서 확인한다 | [네이버웍스 공지 설정·해제](https://help.worksmobile.com/ko/use-guides/board/post/set-post-as-notice/), 직원 쓰기의 학생회 잠금(`inCouncilChange`) | 쉽다 |
| 내린 공지 | 홈·모아 보기·대화 어디에도 보이지 않고 이력에만 남는다. 지난 공지(7일 지남)는 모아 보기의 '지난 공지'에 남는다 | 지금 '공지 해제'와 같음, DEC-48 | 쉽다 |
| 보이는 사람 | 지금 운영진 모두, 회장단 포함. 같은 기수(올린 시각의 기수 = 지금 기수)의 공지만 보인다. 공지가 가리키는 전체방 메시지와 그 사진은 들어오기 전 것이어도 본다(DEC-48의 예외를 '내리지 않은 같은 기수 공지의 대상'으로 옮김) | 주인 결정(모두가 알아야 할 정보), [Viva 공지는 대상 전원에게](https://learn.microsoft.com/viva/connections/announcements-viva-connections), DEC-48. 회장단이 빠지면 다른 회장단원이 올린 공지와 내릴 공지를 홈에서 못 본다 | 쉽다 |
| 제목 | 따로 받지 않는다. 메시지는 본문 첫 줄(본문이 없으면 '사진 N장'), 행사는 행사 이름. 서버가 정해 준다 | PRIN-1, [GOV.UK: 묻지 않아도 되는 것은 묻지 않는다](https://www.gov.uk/service-manual/design/form-structure) | 쉽다(빈 칸 더하기) |
| 홈의 자리와 모양 | 홈 맨 위(숫자 카드 위), 부분 이름 '공지'. 지금 공지를 최근 것부터 3줄까지. 줄은 종류 아이콘, 제목(`wrap-anywhere`, 메시지는 본문 3줄까지), 올린 사람과 올린 날('10월 25일 (토)'), 행사는 행사 날짜를 더한다. 4개 이상이면 [모두 보기 N]. 지금 공지가 없으면 부분을 두지 않는다(DEC-76 규칙) | [Viva: 공지는 대시보드 맨 위](https://support.microsoft.com/office/753e0607-0bfd-4712-ad7e-18490dd565a2), [Workplace: 피드 맨 위](https://www.workplace.com/features/key-updates), [네이버웍스 필독은 메인 위 모바일 3개](https://help.worksmobile.com/ko/?p=108616) | 쉽다 |
| 줄을 누르면 | 행사 공지는 그 행사, 메시지 공지는 공지 모아 보기의 그 공지(전문과 사진). 메시지 위치로 가기는 범위 밖(DEC-76 '되도록') | DEC-76 결과, 이동 규칙 7 | 쉽다 |
| 모아 보기 | 홈의 하위 화면 `/home/:c?view=notices`, 제목 '공지'. '지금 공지'와 '지난 공지' 두 묶음, 같은 기수, 최근 것부터 100개(`NOTICE_LIST_MAX`). 메시지는 전문·사진과 [대화에서 보기](전체방), 행사는 [행사 보기]. 회장단은 지금 공지마다 [공지 내리기]. 비면 '공지 없음'. 늘 닿도록 홈 맨 아래에 '지난 공지' 링크 한 줄 | [Viva: Active와 All 탭](https://support.microsoft.com/office/753e0607-0bfd-4712-ad7e-18490dd565a2), AGENTS.md 빈 화면 문구 | 쉽다 |
| 대화 안 | 방 목록의 공지 칸, 전체방 위의 띠, 대화의 모아 보기, 기기의 본 시각(`notice-seen.ts`)을 없앤다. 지금 공지인 메시지에는 흐름 안에 '공지' 표시만 남는다. 메시지 메뉴는 '공지로 올리기'·'공지 내리기'다. 옛 주소 `?tab=notices`는 대화 첫 화면이 된다(파일럿 전이라 저장된 링크가 없다) | 주인 결정(자리는 홈), [Teams 고정 게시물은 정보 창](https://support.microsoft.com/topic/483ec887-188a-4e18-8551-0c4fe691ffff) | 쉽다 |
| 행사에서 올리기 | 행사 상세 머리의 동작에 [공지로 올리기]·[공지 내리기](회장단). 완료한 행사도 올릴 수 있다 | 주인 결정(원래 기록 옆), DEC-38 | 쉽다 |
| 알리기 | 공지를 올리면 지금 운영진 가운데 올린 사람을 뺀 모두에게 휴대폰 알림 한 번('공지' + 제목 앞 100자, DEC-59). 누르면 공지 모아 보기. 알림 기록은 종류 `created`, 대상은 공지. 내리면 알리지 않는다. 같은 대상 다시 올리기(판 없음)는 알리지 않는다 | [Viva 공지는 휴대폰 잠금 화면 알림](https://learn.microsoft.com/viva/connections/announcements-viva-connections), [네이버웍스 필독 알림](https://help.worksmobile.com/ko/use-guides/board/check-post/board-notification/), DEC-59 | 쉽다 |
| 읽음 확인 | 이번에는 하지 않는다. '인지'는 홈 맨 위와 휴대폰 알림이 맡는다. 확인 버튼은 받는 사람에게 새 일이고 덕은 올린 사람이 본다(PRIN-1). 본 사람 기록은 새 개인정보 표라 시범 운영에서 필요가 보이면 정한다 | DEC-76 버린 안('안 읽은 공지'), [Workplace는 본 사람을 관리자 통계로만](https://www.workplace.com/features/key-updates), [Slack 고정 메시지에는 읽음이 없다](https://slack.com/help/articles/205239997-Pin-messages-and-bookmark-links) | 쉽다(표 더하기) |
| 이번 주 행사와 겹침 | 지금 공지에 있는 행사는 홈 '이번 주 행사' 줄에서 뺀다 | DEC-69·DEC-76 겹침(같은 것을 한 화면에 두 번 두지 않는다) | 쉽다 |
| API | `GET /api/organizations/:c/notices` → `NoticeListResponse`(공지마다 번호, 대상 종류·번호, 제목, 올린 사람·시각, 끝 시각, `live`, 메시지는 본문·사진, 행사는 시작·끝 시각, 동작 목록 `actions`에 `notice.withdraw`). `POST .../notices`(`PostNoticeSchema`: `targetKind`, `targetId`) → 201(이미 지금 공지면 200 같은 공지). `POST .../notices/:noticeId/withdraw`(빈 본문) → 200, 이미 내렸으면 판 없이 200. 대상이 없거나 다른 학생회거나 전체방 메시지가 아니거나 내가 볼 수 없으면 404, 권한 없으면 403. `ChatMessage`와 행사 상세에 지금 공지 번호(`noticeId`, 없으면 null)를 둔다 | AGENTS.md '새 API를 만들 때', DEC-38, 지금 `markNotice`의 404 규칙 | 쉽다 |
| 업무에서 공지 만들기 | 지금처럼 글을 전체방에 보내고 같은 거래에서 그 메시지의 공지를 만든다(`SendMessageSchema.notice`). 업무 결과물은 그대로 메시지이고, 단계는 내리지 않은 공지가 있으면 끝남, 모두 내렸으면 빠짐이다. 공지 기록 쓰기가 그 메시지의 단계를 다시 센다 | DEC-82, RULE-41, 015 '진행 단계' | 쉽다 |
| 옮기기 | 마이그레이션이 `is_notice`가 참인 메시지마다 공지 하나를 만든다. 올린 사람·시각은 그 메시지가 공지 표시를 얻은 판(마지막으로 거짓 → 참이 된 판, 처음부터 참이면 판 1)의 바꾼 사람과 시작 시각이다. 판 1의 칸 값은 기록 쓰기 통로(`records/records.ts`)가 쓰는 꼴과 같다. 그 뒤 코드는 `is_notice`를 읽지도 쓰지도 않는다 | AGENTS.md '마이그레이션'(새 표를 읽는 코드보다 먼저 적용, 칸 지우기는 배포 뒤), 0013 선례(허용 값 넓히기) | 어렵다(운영 DB 데이터) |

### 결정 기록 초안

vada-docs `decisions/0086-notices-point-to-records-on-home.md`(DEC-86)로 썼다. 아래는 그 초안이다. 제목: "공지는 운영진 모두가 지금 알아야 할 기록을 가리키고, 홈 맨 위에 둔다". 상태: 채택. DEC-14를 대체하고, DEC-48·DEC-76을 일부 대체한다.

- 맥락: DEC-14는 내부 공지를 운영진 전체방 메시지의 공지 표시로 두고 대화 안에 모았다. 카톡 공지방에 오르던 것은 회의록, 공문, 사진, 일정, 행사 중 급한 변경이었고(DEC-14 맥락), 메시지만으로는 일정 같은 기록을 공지로 올리지 못한다. 공지는 대화 중이 아니라 학생회에 들어올 때 먼저 봐야 하는 것이라, 협업 도구는 공지를 홈이나 피드 맨 위에 둔다(Viva Connections 공지, Workplace Key Updates, 네이버웍스 필독). 주인이 2026-10-25 공지를 "지금 학생회 운영진 모두가 알거나 인지해야 하는 정보"로 정하고 자리를 홈으로 정했다(사용자 결정, 20261025).
- 결정: 공지는 기록 하나를 가리키는 기록이다. 이번 대상은 운영진 전체방 메시지와 행사이고, 화면이 생기는 기록 종류를 더한다. 공지는 원래 기록 옆의 '공지로 올리기'로 만들고 따로 쓰지 않는다. 회장단이 올리고 내린다. 올린 뒤 7일 동안 모든 운영진(회장단 포함)의 홈 맨 위에 보이고, 올리면 휴대폰으로 알린다. 7일이 지나면 지난 공지로 모아 보기에 남고, 내린 공지는 이력에만 남는다. 같은 기수의 공지가 가리키는 전체방 메시지는 들어오기 전 것도 본다(DEC-48의 예외는 그대로). 부서방·회장단방 메시지는 공지가 되지 않는다(PRIN-5). 읽음 확인은 두지 않는다.
- 버린 안: 공지 표시를 메시지에 두기(DEC-14 그대로, 일정을 공지로 올리지 못함), 공지 글을 따로 쓰기(내용을 다시 적게 됨, PRIN-1), 대화 안에 공지 칸·띠를 남기기(자리가 둘이 됨), 공지마다 기간 고르기(새 입력), 읽음 확인 버튼(받는 사람에게 새 일, 덕은 올린 사람).
- 결과: logical-model.md에 표 '공지'(대상, 내린 시각)와 '이름 대응' `notice`를 더하고, RULE-31을 "공지의 대상은 운영진 전체방 메시지와 행사이고, 한 대상의 지금 공지는 하나다"로, RULE-30의 공지 예외를 "내리지 않은 같은 기수 공지가 가리키는 메시지"로, '업무 결과물'의 '메시지(공지)'를 "공지가 있는 메시지"로 고친다. 메시지의 '공지 여부'는 칸을 지우는 마이그레이션과 같은 때 뺀다. 권한표의 공지 칸 이름을 바꾼다(DEC-28). screens.md 홈과 대화를 고친다. 시범 운영에서 운영진이 홈의 공지로 알고 카톡에 다시 묻지 않는지 본다.

## 위험

- **새 표, 기존 CHECK 넓히기, 옮기기(깊게).** 한 마이그레이션에 `record.kind` 허용 값에 `notice` 더하기(넓히기라 위반 행이 없다, 0013), 표 `notice`(외래 키 `(id, kind)`, `(target_id, target_kind)` → record, 허용 종류 CHECK, 대상 인덱스), 옮기기 INSERT를 둔다. 새 표를 읽는 코드보다 먼저 두 DB에 적용한다(진행이 개발 DB, 운영은 main CI). `ops/migrate`의 public 표 수 시험(`migrate-check.test.ts`, `migrate-run.test.ts`)을 하나 늘린다. 옮기기 시험은 마이그레이션 전 DB에 공지 메시지 셋(보낼 때 공지, 나중에 붙임, 붙였다 뗌)을 두고 적용한 뒤 공지가 둘이고 올린 사람·시각이 맞는지, 옮긴 공지를 기록 쓰기 통로로 내릴 수 있는지 본다.
- **적용과 배포 사이.** CI가 마이그레이션을 적용한 뒤 새 코드가 뜨기까지 몇 분 동안 옛 코드가 붙인 공지 표시는 옮겨지지 않는다. 조각 1 배포 뒤 진행이 두 DB에서 `is_notice`가 참인데 공지가 없는 메시지 수가 0인지 본다(파일럿 전이라 0일 것). 옛 코드로 되돌리면 공지는 적용 때 상태로 보인다.
- **볼 수 있는 범위(깊게, PRIN-5).** `visibleMessage`·`shownNotice`가 사진 보기(`chat/photos.ts`), 대화에서 요청·지출 만들기(011, `purchases`, `expenses/chat-evidence`), 업무 결과물(015)의 볼 수 있는가를 정한다. 이 조건을 공지 표로 옮기고, 보이는 공지와 내릴 수 있는 공지와 넓어지는 메시지가 한 도우미에서 나오게 한다(자주 잡힌 것 12). 내린 공지의 메시지는 다시 DEC-20을 따른다. 다른 학생회의 같은 모양 공지로 거르기를 시험한다(자주 잡힌 것 6, 11).
- **권한 이름 바꾸기(깊게).** `chat.notice` → `notice.manage`가 contracts `Action`, `access/permissions.ts`(시험 포함), 업무 `canMake`, 화면의 메뉴 조건에 닿는다. 가진 사람은 그대로다.
- **기록 쓰기 고리.** `notice` 기록 쓰기는 결과물 종류가 아니지만 그 대상 메시지의 단계를 바꾼다. `tasks/result-sync.ts`가 공지 쓰기를 대상 메시지로 옮겨 세는지, 기존 `tasks/result-others.test.ts`의 공지 경우가 새 길로 그대로 통과하는지 본다. pg-smoke의 공지 경우(`ops/pg-smoke/pg-smoke-notice-case.ts`)를 새 길로 고치고 진행이 돌린다.
- **뒤에서 보내는 알림.** 거래가 끝난 뒤 한 번 보낸다(지금 멘션 알림과 같은 길). 이벤트 요약은 `push_fanout` 한 줄(칸은 003 '위험'), 예외·기기 실패는 `push_send_failed`이고 공지는 그대로다. 정상 종료 때 대기 업무 타이머를 바로 내보내고 진행 중인 알림을 최대 5초 기다린다. 강제 종료·상한 뒤의 유실을 막는 outbox는 나중이다. 받는 사람은 보낼 때 다시 읽은 지금 운영진이며 보는 중이어도 보낸다(시연 기준). 잠금 화면 내용은 DEC-59 범위다.
- **새 라우트 모듈.** `notices`를 `AppOptions`로 연결하고 `boundary.test.ts`가 두 변경 라우트를 검사한다. AGENTS.md의 입력 경우(모르는 키, 틀린 종류, 형식이 틀린 번호, 다른 학생회 사용자, 미인증)를 시험한다.
- **와이어프레임.** Figma(`B5OHqrl9bbvXCUkhME4Sfo`)의 홈 노드와 비교하되, 공지가 맨 위로 온 것은 이 명세가 정한 차이다.

### 사람이 시작 전에 할 일

없음.

## 조각

1 → 2 → 3은 서버라 차례로 한다(같은 공지 모듈을 고친다). 4는 2가 main에 오른 뒤, 5는 2·4 뒤에 시작한다. 3과 4는 나란히 한다. 시간이 모자라면 5에서 행사 상세의 버튼을 빼고(API로는 된다) 3을 다음으로 넘긴다.

### 1. 공지 표와 옮기기(서버) [ ]
- 할 수 있게 되는 것: 지금의 공지가 새 공지 기록으로 옮겨지고, 대화와 업무가 그것을 읽고 쓴다(화면은 지금과 같다).
- 수용 기준: 마이그레이션을 적용하면 공지 표시가 있던 전체방 메시지마다 공지가 하나 있고 올린 사람·시각이 표시를 붙인 판의 것이며, 붙였다 뗀 메시지에는 없다. 그 뒤 `POST messages/:id/notice`의 붙이기·떼기, `notice: true` 보내기, `GET chat/notices`, 방 목록의 공지, 메시지의 `isNotice`가 지금과 같은 응답을 내고, 붙이면 공지 기록과 판이 생기고 떼면 내린 시각과 바꾼 사람이 판에 남는다. 같은 메시지를 다시 붙이면 판이 늘지 않는다. 들어오기 전의 같은 기수 공지 메시지와 그 사진은 보이고, 내린 공지의 것은 보이지 않는다. 업무에서 만든 공지는 업무를 끝남으로, 내리면 빠짐으로 한다(015 시험 그대로). 서버 코드에 `isNotice`(`is_notice`) 읽기·쓰기가 없다. 지금 chat·tasks·purchases·expenses 시험이 그대로 통과한다.
- 닿는 곳: `apps/api/migrations/`(새, `record.kind` 넓히기와 표 `notice`와 옮기기), `src/db/schema.ts`·`schema-records.ts`, `ops/migrate/*.test.ts`(표 수), api 공지 모듈(새, `notices/`), `chat/notice.ts`, `chat/send.ts`, `chat/messages.ts`, `chat/stage.ts`, `chat/queries.ts`, `tasks/result-sync.ts`, `records/records.ts`(종류 목록), `ops/pg-smoke/pg-smoke-notice-case.ts`.
- 검토: 깊게(운영 DB 데이터, 볼 수 있는 범위). 마이그레이션: 있음.

### 2. 공지 올리기·내리기·목록 API(서버) [ ]
- 할 수 있게 되는 것: 회장단이 전체방 메시지나 행사를 공지로 올리고 내리며, 운영진이 같은 기수의 공지를 받아 본다.
- 수용 기준: 회장단이 `POST notices`로 전체방 메시지나 행사를 올리면 201이고, 지금 공지인 대상을 다시 올리면 200 같은 공지에 판이 늘지 않으며, 내렸거나 7일 지난 대상은 새 공지다. 부서방·회장단방·행사방 메시지, 다른 학생회의 메시지·행사, 없는 번호는 404, 회장단이 아니면 403, 로그인하지 않으면 401, 모르는 키·틀린 `targetKind`·형식이 틀린 번호는 400이다. `withdraw`는 남이 올린 공지도 내리고, 이미 내렸으면 판 없이 200이다. `GET notices`는 같은 기수의 내리지 않은 공지를 최근 것부터 주고, 7일 안이면 `live`가 참, 회장단에게만 `actions`에 `notice.withdraw`가 있다. 다른 기수·다른 학생회·내린 공지는 없다. 메시지 공지의 제목은 첫 줄(사진만이면 '사진 N장'), 행사 공지는 행사 이름이다. `ChatMessage`·행사 상세의 `noticeId`가 지금 공지를 가리킨다. 권한 키가 `notice.manage`이고 `chat.notice`가 없다. JSON은 `no-store`다. 7일 경계는 주입한 시계로 ±1초를 본다(자주 잡힌 것 5).
- 닿는 곳: contracts `notices.ts`(새: `NOTICE_TARGET_KINDS`, `PostNoticeSchema`, `NoticeSummary`, `NoticeListResponse`, 7일 상수), `chat.ts`(`ChatMessage.noticeId`), `events.ts`(상세의 `noticeId`), `permissions.ts`, `index.ts`, api `notices/`(라우트·서비스·조회), `app.ts`·`serve.ts`의 등록, `access/permissions.ts`·시험, `tasks/`의 `canMake`, `http/boundary.test.ts`.
- 검토: 깊게(권한, 격리). 마이그레이션: 없음.

### 3. 공지를 올리면 휴대폰으로 알리기(서버) [ ]
- 할 수 있게 되는 것: 공지가 올라오면 운영진이 앱을 열지 않아도 안다.
- 수용 기준: 메시지·행사를 공지로 올리면(업무에서 만든 공지 포함) 올린 사람을 뺀 지금 운영진의 기기에 '공지'와 제목 앞 100자가 한 번 가고, 누르면 `/home/:c?view=notices`가 열린다. 받는 사람마다 종류 `created`의 알림 기록이 같은 거래에 남는다. 떠난 운영진과 다른 학생회 사람은 받지 않는다. 같은 대상 다시 올리기(200)와 내리기는 보내지 않는다. 응답은 알림을 기다리지 않고, 보내기가 실패해도 공지는 그대로다.
- 닿는 곳: api 공지 알림 모듈(새, `notices/` 안), `push/fanout.ts`, `notices/` 서비스·라우트, contracts `paths.ts`(홈 `view=notices`), 알림 시험.
- 검토: 깊게(뒤에서 보내는 일, 받는 사람 거르기). 마이그레이션: 없음.

### 4. 홈 맨 위의 공지와 모아 보기(화면) [ ]
- 할 수 있게 되는 것: 모든 운영진이 홈 맨 위에서 지금 공지를 보고, 모아 보기에서 지난 공지까지 본다.
- 수용 기준: 지금 공지가 있으면 회장단을 포함한 모든 운영진의 홈 숫자 카드 위에 '공지' 부분이 있고, 최근 것부터 3줄까지 종류 아이콘·제목·올린 사람·'10월 25일 (토)'(행사는 행사 날짜도)이 보이며, 4개 이상이면 [모두 보기 N]이다. 지금 공지가 없으면 부분이 없다. 행사 줄을 누르면 그 행사가, 메시지 줄을 누르면 모아 보기의 그 공지가 열린다. 홈 맨 아래 '지난 공지'와 [모두 보기]는 `/home/:c?view=notices`를 연다. 모아 보기는 '지금 공지'와 '지난 공지' 묶음이고, 메시지는 전문·사진·[대화에서 보기], 행사는 [행사 보기]이며, `actions`에 `notice.withdraw`가 있을 때만 [공지 내리기]가 보이고 누르면 목록과 홈에서 빠진다(보내는 동안 `busy`). 비면 '공지 없음'이다. 403·404는 자주 잡힌 것 1대로 닫고 이유를 보인다. 공지에 있는 행사는 '이번 주 행사' 줄에 없다. 긴 제목은 390px에서 넘치지 않는다.
- 닿는 곳: `apps/web/src/home/`(`NoticesSection.tsx`, `HomeBody.tsx`, `home-view.ts`, `useHomeExtras.ts`, 모아 보기 화면과 공지 읽기 훅(새, `home/` 안)), `test-support/home-fixtures.ts`, `lib/messages.ts`, `ui-gallery/`.
- 검토: 보통. 마이그레이션: 없음.

### 5. 원래 기록 옆의 '공지로 올리기'와 대화의 공지 정리(화면) [ ]
- 할 수 있게 되는 것: 회장단이 전체방 메시지 메뉴와 행사 상세에서 공지를 올리고 내리며, 대화에는 공지 칸과 띠가 없다.
- 수용 기준: 회장단에게 전체방 메시지의 메뉴에 '공지로 올리기'(지금 공지면 '공지 내리기')가 있고, 누르면 그 메시지에 '공지' 표시가 붙거나 떨어지며 홈 공지가 바뀐다. 행사 상세에는 [공지로 올리기]·[공지 내리기]가 회장단에게만 보인다. 회장단이 아니면 둘 다 없다. 실패는 그 동작 옆 문구이고 두 번 가지 않는다. 대화의 방 목록에 공지 칸이 없고, 전체방 위에 띠가 없으며, `?tab=notices`는 대화 첫 화면이다. 업무 상세의 [공지 만들기]는 지금처럼 동작한다. `NoticeEntry`·`NoticeBand`·`NoticePage`·`notice-seen.ts`와 서버의 `POST messages/:id/notice`·`GET chat/notices`·방 목록의 `notices`가 없다(knip 통과). 부품 확인 화면과 스냅숏이 새 문구다.
- 닿는 곳: `apps/web/src/chat/`(`useMessageActions.ts`, `useNoticeMark.ts`, `MessageItem.tsx`, `RoomList.tsx`, `RoomView.tsx`, `ChatPage.tsx`, `ChatRoute.tsx`, 지우는 공지 파일들과 시험), `events/EventDetailView.tsx`, `tasks/NoticeMakeDialog.tsx`, contracts `chat.ts`·`paths.ts`, api `chat/routes.ts`·`chat/queries.ts`·`chat/notice.ts`, `lib/messages.ts`, `ui-gallery/`, `src/__snapshots__/`.
- 검토: 보통. 마이그레이션: 없음.

## 닫기

기기 확인은 사람이 하고 `docs/device-checks.md`의 새 절 '공지'에 옮긴다. A는 회장(데스크톱 Chrome), B는 기획부 부원(아이폰, 알림 켬), C는 부회장(갤럭시).

1. A가 전체방 메시지 메뉴에서 '공지로 올리기' → B의 잠금 화면에 '공지' 알림이 오고, 누르면 공지 모아 보기에 그 글이 보인다. B와 C의 홈 맨 위에 그 공지가 있다.
2. A가 행사 상세에서 [공지로 올리기] → 홈 공지에 행사 이름과 날짜가 있고 누르면 그 행사가 열린다. B의 '이번 주 행사'에 그 행사가 두 번 나오지 않는다.
3. C가 홈 '지난 공지' → 모아 보기에서 A가 올린 메시지 공지를 [공지 내리기] → A와 B의 홈에서 빠지고 전체방의 '공지' 표시도 없다.
4. B의 대화 방 목록에 공지 칸이 없고 B의 메시지 메뉴에 '공지로 올리기'가 없다.

지표와 회고 세 줄은 이 아래에 적는다.
