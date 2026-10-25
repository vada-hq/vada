---
독자: 에이전트
---

# 021 개인정보 약속 지키기

> 만들 때의 명세다. 지금의 규칙은 vada-docs `decisions/`와 `logical-model.md`, 동작은 코드가 원문이다(DEC-77).

상한: 9시간(실제로 도는 시간). 조각이 11개라 기본값 6시간을 넘긴다. 넘으면 조각 10과 11을 다음 기능으로 넘긴다(둘은 시범 운영 전 필수가 아니다). 시작 2026-10-25 18:54. 양식은 `docs/work-method.md`를 따른다. 가지는 `work/021-조각번호`, 진행 기록은 `.superpowers/sdd/021/progress.md`.

## 왜

처리방침(`vada-docs/legal/privacy-policy.md`)과 이용약관(`legal/terms.md`)이 약속한 것 가운데 코드에 없는 것이 있다. 1판의 `{시행일}`은 첫 시범 운영 시작일이라(`legal/README.md`), 그날까지 코드가 문장을 지키거나 문장이 코드에 맞아야 한다. 지키지 못하면 처리방침이 사실과 다른 채 시행되고, 삭제 요구를 10일 안에 처리하지 못하면 개인정보 보호법 제36조 제2항 위반(제75조 제2항 과태료)이 된다. 확인 보고서는 `notes/privacy-message-delete.md`(vada main `c43494f` 기준)다.

- 탈퇴가 없다. 처리방침 3조·6조 ④·11조 4·12조와 약관 13조, 제안서가 약속한다(DEC-54, DEC-64). 지금은 손 SQL뿐이고 절차도 없다.
- Google 프로필 사진과 토큰을 저장한다. 처리방침 1조 ②("저장하지 않습니다")와 DEC-53 결과("저장하지 않게 고치고, 이미 저장한 값을 비운다")가 안 됐다.
- 기한 파기가 넷(신청자, 납부 학번, 열람 기록, 명령 영수증)뿐이다. 세션의 IP·브라우저 정보 3개월, 학생회가 그만둔 뒤 30일 파기, 대화 사진의 R2 객체, 탈퇴 뒤 1년의 동의 기록이 없다(DEC-55).
- 메시지 지우기가 없다. 처리방침 11조 5항("언제든 지울 수 있습니다")과 약관 10조 ①("회장단은 … 지울 수 있으며")이 없는 기능을 적었다. 법이 요구하는 것은 요구 창구, 10일 안의 조치와 통지, 되살릴 수 없는 삭제다(보고서 4절). 그래서 문장을 '학생회에 요청하면 VADA가 10일 안에 지운다'로 고치고, 그 약속을 지킬 손 명령을 두고, 쓴 사람의 지우기(DEC-54)는 시작 전에 시도한다(보고서 권장 (다)).

근거 결정(다시 정하지 않는다): DEC-51(동의 기록), DEC-53(처리자 구분, Google 값), DEC-54(행은 남기고 값은 모든 판에서 비우기, 탈퇴, 메시지 지우기), DEC-55(보관 기간표, 그만둘 때 30일), DEC-56(VADA 팀은 학생회 데이터를 보지 않음, AI 에이전트는 개수만), DEC-57(지금 기수), DEC-64(탈퇴 확인 화면, 회장은 넘긴 뒤, 다시 가입하면 새 계정), DEC-72(본인 확인, 통째 파기는 보호책임자 확인), RFC-7 등급표(메시지 고치기와 지우기는 '되도록·시작 전'), `logical-model.md`(운영진 '탈퇴한 시각', 메시지 '지운 시각', 파일 비우기, 표시 이름 계산, RULE-15·16·17).

### 원칙 대조

- 새로 하는 입력
  - 탈퇴: 확인 화면에서 [탈퇴]를 한 번 누른다(로그인한 지 하루가 지났으면 Google 로그인을 한 번 더). 하는 사람이 바로 이득(계정이 지워짐)이다. 회장은 직급을 먼저 넘겨야 하는데, 이는 DEC-64가 정한 대가다.
  - 메시지 지우기(조각 1~8 동안): 쓴 사람이 앱 밖에서 학생회(회장이나 연락 담당)에게 요청하고, 학생회가 VADA에 이메일로 넘긴다. 쓴 사람에게는 바로 이득이지만 학생회는 수고만 진다(PRIN-1에 어긋난다). 그래서 조각 11(쓴 사람이 앱에서 지우기)을 시작 전에 시도하고, 들어오면 학생회의 수고가 사라진다.
  - 메시지 지우기(조각 11): 메시지 메뉴의 '메시지 삭제'와 확인 한 번. 쓴 사람에게 바로 이득이다.
  - 나머지(Google 값, 세션, 기한 파기, 사진 객체)는 사람이 새로 하는 입력이 없다. 학생회 그만두기는 학생회가 이메일로 알리고 VADA가 명령으로 처리한다(DEC-55 '시범 운영 동안 손으로').
- 근거 연결: AI 초안은 없다. 지운 메시지를 근거로 이은 곳(요청·지출의 근거 메시지, 업무 결과)은 연결 행을 남기고 "삭제된 메시지"로 보인다(DEC-54). 증빙으로 따로 복사한 사진은 남는다(DEC-45, `expenses/chat-evidence.ts`의 `storage.copy`). 근거의 내용은 사라지지만 근거가 있었다는 사실은 남는다. 이것이 DEC-54가 PRIN-2와 삭제 요구 사이에서 정한 자리다.
- 변경 이력: 탈퇴는 학생회 소속·부서 소속을 끝내는 판과 운영진의 새 판에 사유 '탈퇴'를 남긴다. 메시지 지우기는 새 판에 지운 사람(VADA가 지우면 비움)과 사유를 남긴다. 이름·이메일·본문·사진 위치는 지금 값과 모든 이전 판에서 비운다(DEC-54 결과: 비운 시각과 사유는 판에 남고, 값은 되살릴 수 없게). 학생회 통째 파기는 이력까지 모두 지운다(DEC-55).

## 범위 밖

- 회장단이 남의 메시지를 지우기(DEC-54 '되도록'). 시범 운영 동안에는 조각 8의 명령으로 VADA가 대신 지운다. 메시지 고치기, 약관 10조 ②의 '글 가리기'.
- 열람·정정 요구의 앱 기능(이메일로 받는다, 처리방침 12조). 약관·처리방침의 이전 판 보기와 비교표(DEC-64, DEC-72). 서비스를 끝낼 때의 절차(DEC-64. 조각 9의 파기 명령을 그때 다시 쓴다).
- 사람이 직접 적은 글 속의 이름(메시지 본문, 예금주, 입금자명 등)은 탈퇴해도 바뀌지 않는다. GitHub도 계정을 지우면 작성자만 ghost로 바꾸고 본문의 언급은 두며([GitHub, 계정 삭제](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-your-personal-account/deleting-your-personal-account)), DEC-54도 이름 표시만 바꾼다. 지우려면 조각 8로 요청한다.
- 환불 대기 정보의 파기(DEC-55). 보고서가 보지 않았고 따로 확인한다. 학생회 내보내기 도구(시범 운영 동안 VADA 팀이 손으로, DEC-55). 이미 휴대폰에 도착한 알림(거둘 수 없다).

## 정한 것

결정에 없는 빈칸만 정했다. 근거가 갈리면 되돌리기 쉬운 쪽을 골랐다.

| 무엇 | 정한 것 | 근거(주소) | 되돌리기 |
|---|---|---|---|
| 1 Google 값이 들어가는 곳 | better-auth 1.7.6은 처음 로그인할 때 `createUser`에 `image`를, `createAccount`에 `accessToken`·`refreshToken`·`idToken`·두 만료 시각을 넣는다(`better-auth/dist/oauth2/link-account.mjs` `handleOAuthUserInfo`). 다시 로그인하면 `account.updateAccountOnSignIn`이 꺼져 있지 않은 한 새 토큰으로 `updateAccount`한다. `overrideUserInfoOnSignIn`을 켜면 `image`도 다시 쓴다. vada는 이 값을 어디서도 읽지 않는다(`apps` 전체에 `accessToken`·`image` 사용 없음, Google API를 부르지 않음) | 코드 확인 | — |
| 2 막는 법 | `createAuth`에 `databaseHooks`를 둔다: `user.create.before`·`user.update.before`는 `image`를 비우고, `account.create.before`·`account.update.before`는 토큰 셋과 두 만료 시각을 비운다(before 훅이 돌려준 `data`가 넣을 값이 된다). `account.updateAccountOnSignIn: false`로 쓸모없는 갱신도 끈다. `mapProfileToUser`는 쓰지 않는다: 로그인 경로 하나만 막고 계정 잇기·갱신 경로는 못 막는다. 맨 뒤 방어로 DB CHECK(정한 것 3)를 둔다 | [better-auth Database Hooks](https://www.better-auth.com/docs/concepts/database#database-hooks) | 쉽다 |
| 3 이미 저장된 Google 값 | 마이그레이션 G 하나로 `users.image`와 `accounts`의 토큰 셋·두 만료 시각을 모두 NULL로 바꾸고, 같은 파일에서 `CHECK (image IS NULL)`, `CHECK (access_token IS NULL AND refresh_token IS NULL AND id_token IS NULL)`를 건다. UPDATE 다음에 CHECK를 걸어 위반 행이 남을 수 없다. 손 SQL이 아니라 마이그레이션으로 하는 까닭: 운영 DB는 main CI가 적용하고 기록이 남으며, 행 내용을 보지 않는다(DEC-56). 코드(조각 2)가 배포된 뒤 따로 올린다. 먼저 올리면 그사이 로그인이 값을 다시 쓴다 | DEC-53 결과, AGENTS.md '마이그레이션'(제약은 코드 배포 뒤) | 제약은 쉽다. 지운 값은 되살리지 않는다(뜻한 대로) |
| 4 세션의 IP·브라우저 3개월 | 기한 파기(`runPurge`)에 더한다. 만료된 세션 줄은 지운다(DEC-55 '만료되면'). 만든 지 3개월이 지난 세션은 줄과 로그인은 두고 `ip_address`·`user_agent`만 NULL로 비운다. better-auth는 IP를 세션을 만들 때만 적고(`db/internal-adapter.mjs` `createSession`), 갱신은 만료 시각만 늘린다. 만료된 세션은 그 쿠키가 다시 올 때만 지운다(`api/routes/session.mjs`). 그래서 계속 쓰는 세션은 처음 IP를 3개월 넘게 들고, 다시 오지 않는 세션 줄은 남는다. 3개월마다 강제로 다시 로그인시키는 안(OWASP의 절대 만료)은 사람에게 새 수고를 주므로 버렸다 | DEC-55 표, [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | 쉽다 |
| 5 탈퇴 경로 | 직접 만든 `POST /api/me/withdrawal`(본문 `EmptyRequestSchema`)이다. better-auth의 `user.deleteUser`는 꺼 둔 채로 둔다. 그 경로는 자기 어댑터 호출로 지워서, 운영진·소속·판 비우기와 한 거래로 묶을 수 없다 | AGENTS.md '새 API'(자기 것은 `/api/me/`) | 쉽다 |
| 6 다시 로그인 | 탈퇴는 세션을 만든 지 24시간 안일 때만 된다. 지났으면 403 `REAUTH_REQUIRED`이고, 화면은 Google로 다시 로그인하게 한 뒤 확인 화면을 다시 연다. 되돌릴 수 없는 일이라 잠깐 자리를 비운 휴대폰에서 지워지지 않게 한다 | [better-auth 세션 신선도 freshAge 기본 1일](https://www.better-auth.com/docs/concepts/session-management), [GitHub sudo mode](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/sudo-mode) | 쉽다(검사 빼기) |
| 7 회장 막기 | 어느 학생회든 그 학생회의 지금 기수(DEC-57의 도우미)에서 회장이면 409 `PRESIDENT_CANNOT_WITHDRAW`이다. 지난 기수의 회장 직급은 막지 않는다(넘길 수 없다). 넘기기(`transferPresident`)와 겹치지 않게, 탈퇴는 열린 소속이 있는 학생회 행을 모두 id 차례로 `lockCouncil`과 같은 잠금으로 잡은 뒤 본다. 혼자 남은 회장은 넘길 사람이 없으므로 학생회 그만두기(조각 9)를 거치거나 이메일로 요청한다 | DEC-64, `team/service.ts`의 넘기기, `access/authorize.ts` | 쉽다 |
| 8 탈퇴가 하는 일 | 한 거래에서 차례로 한다. ① 그 운영진의 열린 학생회 소속과 부서 소속의 끝 시각을 채운다(판 사유 '탈퇴', 바꾼 사람 본인). 대화방 참여 줄은 내보낼 때와 같은 도우미로 지운다(`chat/rooms.ts`). ② 운영진에 탈퇴한 시각을 넣고 이름·이메일을 비운 새 판(사유 '탈퇴')을 남긴 뒤, 그 운영진의 모든 이전 판에서 `name`·`email`을 비운다(`registrations/personal-values.ts`의 판 비우기 방식). ③ 그 계정의 동의 기록에 탈퇴한 시각을 적는다. ④ `member_login`, 알림 기기, 세션, `accounts`, `users`를 지운다(`users`를 지우면 뒤의 셋은 외래 키로 함께 지워진다). 응답은 세션 쿠키를 지운다. 학생회 기록의 행(메시지, 업무, 지출 등)은 그대로이고 만든 사람만 '떠난 운영진 N'으로 보인다 | DEC-54, DEC-55(로그인 세션·알림 구독은 탈퇴할 때), RULE-16 | 어렵다(깊게 검토) |
| 9 '떠난 운영진 N' | 저장하지 않고 읽을 때 센다(`logical-model.md` 계산되는 값). N은 그 학생회에 소속(어느 기수든)이 있었던 탈퇴한 운영진을 탈퇴한 시각, 같으면 운영진 id 차례로 센 번호다. 새 탈퇴는 늘 뒤에 붙어 이미 매긴 N은 바뀌지 않는다. 이름을 읽는 모든 조회(약 25곳: `chat/`, `tasks/`, `events/`, `expenses/`, `purchases/`, `incomes/`, `closing/`, `registrations/`, `team/`, `councils/`, `records/versions.ts`, 1:1 방 이름, 알림 글)는 공유 도우미 하나로 표시 이름을 얻는다. `member.name`을 그 도우미 밖에서 읽지 못하게 `no-own-clock.test.ts` 같은 정적 시험을 둔다. 탈퇴한 운영진의 이메일은 응답에서 null이다 | DEC-54(학생회마다, 같은 사람은 같은 N), [GitHub ghost](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-your-personal-account/deleting-your-personal-account) | 쉽다(계산만) |
| 10 동의 기록 1년 | `terms_agreement.user_id`의 `ON DELETE CASCADE` 외래 키를 뺀다. 그대로 두면 `users`를 지울 때 동의 기록도 지워져 '탈퇴하고 1년'(DEC-55)을 못 지킨다. 탈퇴한 시각 칸 `withdrawn_at`을 더하고, 기한 파기가 1년이 지난 줄을 지운다. 남는 것은 계정 id(가명)·판·시각뿐이다 | DEC-51, DEC-55, 처리방침 1조 ② 표 | 쉽다 |
| 11 이메일로 온 탈퇴 요청 | 처리방침 6조 ④는 이메일 탈퇴 요청을 받는다. 2조(만 14세 미만 7일)도 '탈퇴와 같이' 지운다. 같은 서비스 함수를 운영 명령 `privacy withdraw --email <가입 이메일>`로 부른다(회장 막기 같음, 다시 로그인 검사만 없음). 본인 확인은 DEC-72대로 사람이 먼저 한다 | DEC-72 | 쉽다 |
| 12 지운 메시지의 표 | 메시지에 지운 시각 `deleted_at`을 더하고 `body`의 NOT NULL을 빼며 `CHECK ((deleted_at IS NULL) = (body IS NOT NULL))`. 파일의 `name`·`storage_key` NOT NULL을 빼고 `CHECK ((name IS NULL) = (storage_key IS NULL))`. 지우면 메시지 본문과 그 메시지에 붙은 파일의 이름·저장소 위치를 지금 값과 모든 판에서 비우고, 메시지에 새 판(지운 사람, 사유)을 남긴다. 파일 행은 남는다 | `logical-model.md` 메시지·파일, RULE-17, DEC-54 | 어렵다(깊게) |
| 13 지운 메시지의 표시 | 응답의 메시지는 `body: null`, `deletedAt`, 사진 없음이다. 화면은 그 자리에 '삭제된 메시지'를 보인다. 공지였던 메시지는 공지 목록에서 빠진다(`chat/stage.ts`의 'excluded'와 같은 규칙). 업무 결과의 제목(`tasks/results.ts`의 본문 첫 줄)과 요청·지출의 근거 메시지도 '삭제된 메시지'다. 사진 목록과 파일 열기(`/files/:fileId`)에서 빠진 파일은 404다 | DEC-54, `screens.md` 21줄 | 쉽다 |
| 14 손으로 지우는 명령 | `pnpm --filter @vada/api privacy erase-messages --invite <초대 코드> (--sender <이메일> \| --left <N>) --from <한국 시각 분> --to <한국 시각 분> [--expect <개수>] [--apply] [--from-shell]`. 학생회는 초대 코드(회장이 운영진 > 사람에서 보는 값)로 가린다. 학생회 id나 이름을 DB에서 찾아보지 않으려는 것이다. 미리 보기가 기본이고, 대상(호스트·DB 이름)과 개수만 보인다(메시지, 판, 사진 파일, 저장소 객체, 이미 지운 것). 본문·이름·id는 출력하지 않는다(DEC-56, AGENTS.md '로그·비밀'). `--apply`는 `--expect`가 미리 보기의 개수와 같을 때만 쓴다. 차례: 사진 객체를 R2에서 지우고(없는 객체는 성공으로 본다), 그다음 한 거래로 비운다. 거래가 실패해도 다시 돌리면 끝까지 간다(같은 일을 두 번 해도 같다). 판의 사유는 '학생회 요청으로 VADA가 지움', 지운 사람은 비운다. R2 값 넷이 없으면 연결하기 전에 멈춘다. 배포 DB 규칙은 `demo`와 같다 | DEC-54(시범 운영 동안 VADA 팀이 대신), DEC-56, AGENTS.md `demo`·`test-data` | 쉽다(명령) / 지운 값은 되살리지 않음 |
| 15 학생회 그만두기 | 학생회에 `closing_requested_at`(그만둔다고 알린 시각)을 더한다. 명령: `privacy council-close --invite <코드>`(표시), `privacy council-reopen --invite <코드>`(이어 쓰면 지움), `privacy council-destroy --invite <코드> [--now]`. 표시된 학생회는 읽기만 된다: `authorizeChange`를 거치는 모든 변경이 409 `COUNCIL_CLOSING`, 공개 참가 신청은 마감된 양식과 같은 응답, 초대 코드로 들어오기는 404다. 파기는 표시한 날(한국 날짜)부터 30일이 지났거나 `--now`(학생회가 바로 지워 달라고 함)일 때만 된다. 미리 보기는 표마다 개수를 보이고, 보호책임자가 그것을 확인한 뒤 `--apply`한다(DEC-72). 파기는 그 학생회의 모든 R2 객체를 먼저 지우고, 한 거래로 그 학생회의 모든 행(기록, 하위 표, 판, 연결 표, 초대 코드, 명령 영수증, 신청 개인 링크)을 지운다. 다른 학생회 소속도 로그인도 없는 운영진은 함께 지운다. 로그인 계정과 신청자 열람 기록(VADA의 법령상 의무 기록, DEC-72)은 남긴다 | DEC-55, DEC-72, 약관 12조, 처리방침 10조 ④ | 어렵다(깊게) |
| 16 붙지 않은 사진 객체 | 저장소의 `chat/`·`evidence/` 아래 객체 가운데 어느 파일 행도 가리키지 않고 올린 지 72시간이 지난 것을 지운다. R2의 수명 규칙(lifecycle)은 접두어와 나이로만 가려 붙은 사진까지 지우므로 쓰지 않는다. `FileStorage`에 목록(ListObjectsV2, 키와 LastModified)을 더한다. 보내기와 증빙 붙이기는 올린 지 24시간이 지난 객체를 `UPLOAD_MISMATCH`로 거절한다(지우기와 보내기가 겹치지 않게 사이를 둔다). 저장소 호출은 DB 거래와 잠금을 오래 잡지 않게 `runPurge`의 거래 밖에서 자기 잠금 번호로 돈다. 저장소가 설정되지 않았으면 건너뛴다 | 처리방침 6조 ③ Cloudflare 줄, [R2 S3 API(ListObjectsV2)](https://developers.cloudflare.com/r2/api/s3/api/), [R2 object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) | 쉽다 |
| 17 쓴 사람의 지우기 | `POST /api/organizations/:councilId/messages/:messageId/delete`(본문 `EmptyRequestSchema`). 쓴 사람만 된다. 남의 메시지, 다른 학생회, 안 보이는 메시지, 없는 번호는 모두 404다(있는지 드러내지 않는다). 이미 지운 메시지는 200이고 바뀌는 것이 없다. 기간 제한은 없다(DEC-54 '언제든', [Slack 메시지 삭제](https://slack.com/help/articles/202395258-Edit-or-delete-messages)는 기본으로 언제든). 사진 객체는 커밋 뒤 지우고, 실패하면 정한 것 16이 지운다. 화면: 내 메시지 메뉴의 '메시지 삭제' → 확인 창 '메시지를 삭제할까요?', [삭제]·[닫기](`components/ConfirmDialog.tsx`). 설명 글은 없다 | DEC-54, RFC-7('되도록'의 1순위, `features/006` 28줄), AGENTS.md '화면 문구와 폼' | 쉽다 |
| 18 처리방침·약관 문장 | 11조 5항: "내가 쓴 메시지와 사진을 지우려면 학생회(회장이나 연락 담당)에게 요청하세요. 학생회의 요청을 받으면 VADA가 10일 안에 지우고, 그 자리에는 "삭제된 메시지"가 남습니다." 약관 10조 ①: "학생회 안의 글은 학생회가 먼저 다룹니다. 학생회가 요청하면 VADA가 메시지를 지우고, 지운 시각과 사유를 남기며 쓴 사람에게 알립니다." 문서에 새 정책을 만들지 않으므로(`legal/README.md`), 같은 커밋에서 DEC-54 '결과'에 한 줄을 더한다: "쓴 사람의 지우기가 들어오기 전에는 회장단 지우기와 같이 학생회의 요청으로 VADA 팀이 지운다(RFC-7 '되도록')." 조각 11이 들어오면 11조 5항을 지금 문장으로 되돌리고, 약관 10조 ①은 회장단 지우기가 들어올 때까지 둔다 | 보고서 5절, DEC-54(회장단 지우기의 시범 운영 단서), 시행령 제43조 제3항(10일) | 쉽다(시행 전 초안은 고쳐 쓴다) |

## 위험

- **운영 DB의 되돌릴 수 없는 삭제(깊게).** 조각 3, 6, 8, 9, 10, 11은 값이나 행이나 객체를 지운다. 시험은 다른 학생회 자료를 같은 날짜·같은 모양으로 두고, 학생회 거르기나 대상 거르기를 지우면 실패하게 한다(자주 잡힌 것 6). 명령은 미리 보기가 기본이고 `--apply`와 `--expect`가 있어야 쓴다.
- **DEC-56과 명령.** DEC-56은 AI 에이전트가 운영 DB에서 '마이그레이션 적용과 개수 조회만' 하게 했다. `privacy` 명령은 내용을 읽거나 출력하지 않고 개수만 보이지만, 값을 바꾸는 것은 그 목록 밖이다. 학생회의 서면 허락(DEC-56 예외 1)을 받은 뒤에만 돌리고, 돌릴 때마다 보호책임자가 미리 보기 개수를 확인한다. 팀이 이 목록에 `privacy` 명령을 더할지 정하기 전에는 보호책임자가 직접 돌린다(사람이 할 일).
- **동시 처리.** 탈퇴와 회장 넘기기는 학생회 행 잠금으로 줄을 세운다(정한 것 7). 메시지 지우기와 '사진을 증빙으로 옮기기'가 겹치면 복사가 저장소 오류로 실패할 수 있다. 그때는 증빙 만들기가 지금 오류 응답으로 끝나고 아무것도 남지 않아야 한다. 객체 지우기와 사진 보내기는 24시간·72시간의 사이로 겹치지 않는다.
- **뒤에서 돌리는 일.** 세션·동의 기록 파기는 `runPurge`의 잠금과 거래 안에서 돌고, 두 번 돌아도 같다. 객체 지우기는 따로 잠그고, 실패는 `reportBackgroundFailure`로 본다. 한 번에 지우는 개수에 상한을 두어 첫 실행이 길어지지 않게 한다.
- **better-auth 판 올리기.** 막는 훅은 지금 판의 쓰기 경로에 기댄다. 새 판이 다른 경로로 `image`나 토큰을 쓰면 CHECK가 그 로그인을 실패시킨다(약속은 지켜지고 장애는 바로 보인다). `auth/auth.test.ts`의 실제 로그인 흐름 시험이 판을 올릴 때마다 잡는다.
- **새 라우트·오류 코드.** `/api/me/withdrawal`과 메시지 지우기는 `AppOptions`로 잇고 `boundary.test.ts`가 본다. 새 오류 코드 `REAUTH_REQUIRED`(403), `PRESIDENT_CANNOT_WITHDRAW`(409), `COUNCIL_CLOSING`(409)는 `packages/contracts/src/errors.ts`와 `apps/web/src/lib/messages.ts`에 더한다.
- **큰 기계적 변경.** 조각 5의 표시 이름 도우미는 약 25개 조회를 바꾼다. 400줄을 넘어도 대부분 이름 바꾸기라 나누지 않는다. 대신 정적 시험이 빠진 곳을 잡는다.
- **계약이 바뀌는 곳.** 메시지 응답의 `body`가 null이 될 수 있으므로 contracts `chat.ts`, web `chat/`, 리허설·시연·pg-smoke의 메시지 사용, `test-support`를 같이 고친다. contracts·web 시험도 돌린다.
- **문서를 같이 고칠 것(DEC-77).** `logical-model.md`의 학생회 줄에 '그만둔다고 알린 시각'을 더한다. 운영진·메시지·파일 줄은 이미 맞다. vada `AGENTS.md` '마이그레이션'의 명령 목록에 `privacy`를 더하고, 작업자와 검토자가 돌리지 않는 명령에 넣는다. `legal/internal-management-plan.md` '파기' 칸이 이 명령과 절차를 가리키게 한다.
- **떠난 운영진의 메시지.** 탈퇴하면 이메일이 비어 `--sender`로 찾을 수 없다. 학생회가 '떠난 운영진 N'을 알려 주면 `--left <N>`으로 찾는다.
- **백업.** 지운 값은 Neon의 복원 기간 동안 백업에 남는다(처리방침 3조 ② 4의 `{백업 기간}`).

### 사람이 할 일

- 시작 전: 없음(R2 값과 DB 주소는 이미 `.env`와 저장소 비밀값에 있다).
- 공개 전 법률 검토에 더할 것: 메시지 삭제를 학생회를 거친 이메일 요청으로만 받는 것이 시행령 제41조 제2항 제2호(수집한 창구와 같게)를 채우는지, 탈퇴 뒤 동의 기록을 1년 두는 근거(처리방침 1조의 `{법률 검토}`), 처리방침 11조 5항과 약관 10조 ①의 고친 문장.
- 팀이 정할 것: DEC-54 '결과'에 더하는 한 줄(조각 1)을 확인한다. DEC-56의 AI 에이전트 목록에 `privacy` 명령을 더할지 정한다.
- 운영(보호책임자): 요청을 받으면 본인 확인(DEC-72), 학생회의 서면 허락(DEC-56), 명령 실행, 10일 안에 요청한 사람과 학생회에 결과 통지, 운영 DB 접근 기록. 학생회를 통째로 파기하기 전에 미리 보기의 대상을 확인한다. Neon의 복원 기간을 확인해 `{백업 기간}`을 채운다.

## 마이그레이션 순서

새 표는 없다(`migrate-check`·`migrate-run` 시험의 public 표 수는 그대로다). 번호와 `_journal.json`이 순번이라, 나란히 만든 조각은 만들기 직전에 main 위로 다시 올린다. 모두 진행 에이전트가 main에 올리기 전에 개발 DB에 적용하고, 운영 DB는 main CI의 `migrate-production`이 적용한다. 정의(`apps/api/src/db/schema-*.ts`)를 같이 고쳐 `schema-match.test.ts`가 통과해야 한다.

| 이름 | 조각 | 내용 | 순서 |
|---|---|---|---|
| W | 5 | 운영진에 `left_at`을 더하고 `name`·`email`의 NOT NULL을 빼며 `CHECK ((left_at IS NULL) = (name IS NOT NULL AND email IS NOT NULL))`. 동의 기록의 `users` 외래 키를 빼고 `withdrawn_at`을 더한다 | 넓히기와 새 칸이라 코드보다 먼저 두 DB에 적용한다. CHECK는 같은 파일에서 NOT NULL을 빼는 것과 함께 걸므로 위반 행이 생길 수 없다(지금은 모두 NOT NULL) |
| D | 8 | 메시지에 `deleted_at`, `body` NOT NULL 빼기와 CHECK. 파일의 `name`·`storage_key` NOT NULL 빼기와 CHECK(정한 것 12) | W와 같다. 먼저 적용 |
| C | 9 | 학생회에 `closing_requested_at`을 더한다 | 새 칸, 먼저 적용 |
| G | 3 | Google 값 비우기와 CHECK 둘(정한 것 3) | 조각 2가 배포된 뒤 진행 에이전트가 파일을 만들어 따로 올린다. 그 전에 두 DB에서 로그인을 해 보고 새로 들어간 값이 없는지 개수로 본다 |

## 조각

1·2·4·5·8은 서로 기대지 않아 나란히 만든다(5와 8은 마이그레이션 번호만 차례로). 3은 2가 배포된 뒤, 6은 5 뒤, 7은 6 뒤, 9·10·11은 8 뒤다. 시범 운영 시작 전 필수는 1~9이고, 10은 권장, 11은 '시작 전에 시도'(DEC-54, RFC-7)다.

### 1. 메시지 지우기 문장 고치기(vada-docs) [ ]
- 할 수 있게 되는 것: 처리방침과 약관이 지금 실제로 하는 메시지 지우기(학생회 요청 → VADA가 10일 안에)를 적는다.
- 수용 기준: 처리방침 11조 5항과 약관 10조 ①이 '정한 것' 18의 문장이다. DEC-54 '결과'에 그 한 줄이 있다. 3조 ③ 2(지울 때의 방법)는 그대로다. `legal/internal-management-plan.md` '파기' 칸이 학생회 요청의 메시지 지우기와 학생회 통째 파기를 `privacy` 명령과 보호책임자 확인으로 한다고 적는다. 바뀐 문서끼리 서로 어긋나는 문장이 없다(`screens.md` 21줄은 그대로 맞다).
- 닿는 곳: vada-docs `legal/privacy-policy.md`, `legal/terms.md`, `legal/internal-management-plan.md`, `decisions/0054-keep-rows-clear-personal-values.md`. 커밋 규칙은 `vada-docs/AGENTS.md`를 따른다.
- 검토: 보통. 마이그레이션: 없음.

### 2. Google 프로필 사진과 토큰을 저장하지 않기 [x]
- 할 수 있게 되는 것: 로그인이 Google 프로필 사진과 토큰을 DB에 남기지 않는다.
- 수용 기준: Google로 처음 로그인하면 `users.image`가 NULL이고, `accounts`의 `access_token`, `refresh_token`, `id_token`, 두 만료 시각이 NULL이다. 같은 계정으로 다시 로그인해도 NULL이다. 로그인, 세션 유지, 로그아웃, 학생회 만들기·들어가기는 지금처럼 된다. `user.deleteUser`는 꺼진 채다.
- 닿는 곳: `apps/api/src/auth/auth.ts`(`databaseHooks`, `account.updateAccountOnSignIn`), `auth/auth.test.ts`.
- 검토: 깊게(인증). 마이그레이션: 없음.

### 3. 이미 저장된 Google 값 지우기(진행 에이전트) [ ]
- 먼저 main에: 조각 2가 배포됨.
- 할 수 있게 되는 것: 지금까지 저장된 사진 주소와 토큰이 두 DB에서 사라지고, 다시 들어갈 수 없다.
- 수용 기준: 진행 에이전트가 마이그레이션 G를 만들어 개발 DB에 적용하고 따로 올린다. 적용 뒤 두 DB에서 `image`가 있는 사용자와 토큰이 있는 계정의 개수가 0이다(개수만 조회). DB에 직접 쓰는 시험에서 `image`나 토큰을 넣으면 막히고, 조각 2의 로그인 시험은 그대로 통과한다.
- 닿는 곳: `apps/api/migrations/`(G), `db/schema-auth.ts`, `db/schema-match.test.ts`.
- 검토: 깊게(운영 DB). 마이그레이션: 있음(G, 코드 배포 뒤).

### 4. 세션의 IP·브라우저 정보 3개월 [x]
- 할 수 있게 되는 것: 기한 파기가 3개월이 지난 IP와 브라우저 정보, 만료된 세션을 지운다.
- 수용 기준: 기한 파기가 돌면 만료 시각이 지난 세션 줄이 없고, 만든 지 3개월이 지난 세션은 `ip_address`·`user_agent`가 NULL이며 그 쿠키로 계속 로그인돼 있다. 3개월에서 1초 모자란 세션은 그대로다(±1초 시험). 두 번 돌려도 같다. 배포 뒤 첫 실행이 운영 DB의 오래된 값도 지운다. 진행 에이전트가 배포 뒤 두 DB에서 3개월이 지난 IP가 0건인지 개수로 확인한다.
- 닿는 곳: 세션 파기 모듈(새, `apps/api/src/auth/`), `purge/run.ts`, `purge/run.test.ts`.
- 검토: 보통. 마이그레이션: 없음.

### 5. 탈퇴의 바탕: 표와 '떠난 운영진 N' 표시(마이그레이션 W) [ ]
- 할 수 있게 되는 것: 탈퇴한 운영진이 모든 화면에서 학생회마다 '떠난 운영진 N'으로 보이고, 동의 기록이 계정을 지워도 남을 수 있다.
- 수용 기준: 진행 에이전트가 main에 올리기 전에 개발 DB에 W를 적용한다. 시험에서 운영진 둘을 차례로 탈퇴한 상태로 두면(조각 6 전이라 시험 도우미로), 그 학생회의 대화 메시지, 1:1 방 이름, 업무 담당자, 행사 책임자, 요청·지출의 요청한 사람·먼저 낸 사람, 수입, 결산·이월, 변경 이력, 신청 화면의 운영진 이름이 '떠난 운영진 1', '떠난 운영진 2'다. 두 학생회에 모두 있던 사람은 학생회마다 그 학생회의 차례로 번호를 받고, 같은 학생회 안에서는 어디서나 같은 번호다. 나중에 한 사람이 더 탈퇴해도 이미 매긴 번호는 그대로다. 탈퇴하지 않은 운영진과 내보낸 운영진은 이름 그대로다. `member.name`을 도우미 밖에서 읽는 코드가 있으면 정적 시험이 실패한다. 동의 기록은 사용자를 지워도 남는다.
- 닿는 곳: `apps/api/migrations/`(W), `db/schema-org.ts`·`schema-auth.ts`, 표시 이름 도우미(새, `apps/api/src/records/` 또는 `team/`), 이름을 읽는 조회 전부(정한 것 9의 폴더), 정적 시험(새, `no-own-clock.test.ts`와 같은 자리), `flows/`, `scripts/demo-data.ts`·`test-data.ts`, `ops/pg-smoke/`, vada-docs `logical-model.md`(바뀌지 않으면 그대로).
- 검토: 깊게(표, 학생회 격리). 마이그레이션: 있음(W, 적용 먼저).

### 6. 탈퇴 서버와 이메일 요청 명령 [ ]
- 먼저 main에: 조각 5.
- 할 수 있게 되는 것: 로그인한 사람이 API로 탈퇴하고, VADA는 이메일로 온 요청을 같은 동작으로 처리한다.
- 수용 기준: `POST /api/me/withdrawal`이 200이면 '정한 것' 8의 ①~④가 모두 되어 있다. 그 사람의 운영진 판 어디에도 이름과 이메일이 없다. 응답 뒤 그 쿠키는 401이고 알림 기기가 없다. 같은 Google 계정으로 다시 로그인하면 새 계정이고, 학생회가 없으며, 초대로 들어가면 새 운영진이 된다(이전 '떠난 운영진 N'은 그대로, DEC-64). 세션이 24시간보다 오래면 403 `REAUTH_REQUIRED`이고 아무것도 바뀌지 않는다. 어느 학생회든 지금 기수의 회장이면 409 `PRESIDENT_CANNOT_WITHDRAW`이고 아무것도 바뀌지 않는다. 넘긴 뒤에는 된다. 탈퇴와 넘기기를 동시에 보내도 회장 없는 학생회가 생기지 않는다. 미인증은 401이다. 기한 파기가 탈퇴하고 1년이 지난 동의 기록을 지우고 1년이 안 된 것은 둔다. `privacy withdraw --email <이메일>`은 미리 보기에 대상과 개수(계정 1, 소속, 판, 기기, 세션)만 보이고, `--apply`로 같은 결과를 낸다. 없는 이메일과 회장이면 바꾸지 않고 멈춘다.
- 닿는 곳: contracts `errors.ts`, 탈퇴 라우트·서비스 모듈(새, `apps/api/src/`), `app.ts`(`AppOptions`)·`serve.ts`, `http/boundary.test.ts`, `chat/rooms.ts`(참여 줄 지우기 도우미), `team/service.ts`(지금 기수 회장 판단을 같이 씀), `purge/run.ts`(동의 기록 1년), `apps/api/scripts/`의 `privacy` 명령(새)과 `package.json`의 스크립트, `src/ops/script-args.ts`, vada `AGENTS.md` '마이그레이션'.
- 검토: 깊게(인증, 데이터 무결성, 동시 처리). 마이그레이션: 없음.

### 7. 탈퇴 화면 [ ]
- 먼저 main에: 조각 6, 기능 020 조각 4(사용자 줄을 누르면 열리는 '내 이름' 창).
- 할 수 있게 되는 것: 운영진과 학생회가 없는 로그인한 사람이 화면에서 탈퇴한다.
- 수용 기준: 옆 메뉴 아래 사용자 줄을 눌러 연 창과, 학생회가 없을 때의 가운데 카드(`SignedInView`)에 '탈퇴'가 있다. 누르면 확인 창 '탈퇴'에 두 문장 "학생회 기록의 내 이름은 '떠난 운영진'으로 바뀌어요."와 "되돌릴 수 없어요."가 있고 [탈퇴]·[닫기]다. [탈퇴]가 되면 로그인 전 화면에 '탈퇴 완료'가 보인다. 회장이면 버튼 옆에 "회장 직급을 넘긴 뒤 탈퇴할 수 있어요."가 보인다. `REAUTH_REQUIRED`면 "다시 로그인한 뒤 탈퇴할 수 있어요."와 [다시 로그인]이 보이고, Google 로그인 뒤 확인 창이 다시 열린다. 보내는 중에는 버튼이 `busy`다. 390px에서 오류가 보인다. 처리방침의 `{탈퇴 메뉴 경로}`(6조 ④, 12조 ②)를 실제 경로로 채운다.
- 닿는 곳: web `workspace/SidebarFooter.tsx`와 그 창, `auth/SignedInView.tsx`·`SignedOutView.tsx`·`useAuthActions.ts`·`popup-login.ts`, 탈퇴 창(새), `components/ConfirmDialog.tsx`, `lib/messages.ts`, `ui-gallery/`, vada-docs `legal/privacy-policy.md`.
- 검토: 보통. 마이그레이션: 없음.

### 8. 지운 메시지의 바탕과 손으로 지우는 명령(마이그레이션 D) [ ]
- 할 수 있게 되는 것: VADA가 학생회의 요청을 받아 메시지와 사진을 모든 판과 저장소에서 지우고, 모든 화면이 그 자리를 '삭제된 메시지'로 보인다.
- 수용 기준: 진행 에이전트가 main에 올리기 전에 개발 DB에 D를 적용한다. `privacy erase-messages`(정한 것 14)의 미리 보기가 개수만 보이고, `--expect`가 다르거나 없으면 쓰지 않는다. `--apply` 뒤 그 메시지는 `body`가 NULL이고 지운 시각이 있으며, 그 메시지와 붙은 파일의 모든 판에 본문·파일 이름·저장소 위치가 없고, R2 객체가 없다. 새 판의 사유는 '학생회 요청으로 VADA가 지움'이다. 증빙으로 복사한 사진과 그 파일 행은 남는다. 같은 명령을 다시 돌리면 '이미 지운 것'으로 세고 바꾸지 않는다. 다른 학생회, 다른 사람, 범위 밖 시각의 메시지는 그대로다(같은 모양의 자료로 시험). 대화 목록, 공지 목록, 업무 결과 제목, 요청·지출의 근거 메시지, 사진 목록이 정한 것 13대로 보인다. 지운 사진의 `/files/:fileId`는 404다. 출력에 본문, 이름, 이메일, id가 없다.
- 닿는 곳: `apps/api/migrations/`(D), `db/schema-records.ts`, contracts `chat.ts`, api `chat/messages.ts`·`notice.ts`·`stage.ts`·`photos.ts`·`queries.ts`·`notify.ts`, `tasks/results.ts`, 근거 메시지를 보이는 조회(`expenses/`, `purchases/`), 판 비우기 도우미(`registrations/personal-values.ts`에서 공유 자리로), `storage/storage.ts`, `privacy` 명령, web `chat/`(메시지 줄, 공지, 사진), 근거 메시지 표시, `lib/messages.ts`, `ui-gallery/`, `flows/`, `ops/pg-smoke/`, `test-support/`.
- 검토: 깊게(표, 운영 DB, 학생회 격리). 마이그레이션: 있음(D, 적용 먼저).
- 운영 DB: 요청이 올 때마다 진행 에이전트나 보호책임자가 명령을 돌린다('위험'의 DEC-56).

### 9. 학생회 그만두기: 읽기만, 30일 뒤 파기(마이그레이션 C) [ ]
- 먼저 main에: 조각 8(R2 지우기와 판 비우기 도우미).
- 할 수 있게 되는 것: 그만둔다고 알린 학생회를 30일 동안 읽기만 열어 두고, 그 뒤나 바로 지워 달라고 한 날에 그 학생회의 데이터를 모두 파기한다.
- 수용 기준: 진행 에이전트가 개발 DB에 C를 적용한다. `privacy council-close --apply` 뒤 그 학생회의 모든 변경 요청이 409 `COUNCIL_CLOSING`이고, 읽기는 된다. 그 학생회의 공개 신청 양식은 마감과 같은 응답이고, 초대 코드는 404다. 다른 학생회는 그대로다. `council-reopen` 뒤 다시 쓸 수 있다. `council-destroy`는 표시한 날부터 30일이 안 됐으면 `--now` 없이는 멈춘다(한국 날짜 경계 ±1초 시험). 미리 보기는 표마다 개수다. `--apply` 뒤 그 학생회를 가리키는 행이 어느 표에도 없고 R2에 그 학생회의 객체가 없다. 다른 학생회 소속이나 로그인이 있는 운영진, 로그인 계정, 신청자 열람 기록은 남고, 같은 모양의 다른 학생회 자료는 개수까지 그대로다. 표시하지 않은 학생회의 파기는 멈춘다.
- 닿는 곳: `apps/api/migrations/`(C), `db/schema-org.ts`, `access/authorize.ts`(`authorizeChange`), `registrations/public-form.ts`·`apply.ts`, `invites/service.ts`, contracts `errors.ts`, web `lib/messages.ts`(·`registration-messages.ts`), `privacy` 명령, vada-docs `logical-model.md` 학생회 줄.
- 검토: 깊게(운영 DB, 학생회 격리). 마이그레이션: 있음(C, 적용 먼저).
- 운영 DB: 학생회가 알리면 진행 에이전트가 표시하고, 파기는 보호책임자가 미리 보기를 확인한 뒤 한다. 결과 통지는 사람이 한다.

### 10. 붙지 않은 사진 객체 지우기 [ ]
- 먼저 main에: 조각 8(`FileStorage` 변경이 겹친다).
- 할 수 있게 되는 것: 올렸지만 보내지 않은 사진과 DB에서 비운 사진의 객체가 저장소에 남지 않는다.
- 수용 기준: 정한 것 16의 일이 돌면, 어느 파일 행도 가리키지 않고 72시간이 지난 `chat/`·`evidence/` 객체가 지워지고, 72시간이 안 된 것과 파일 행이 가리키는 것(증빙 복사본 포함)은 남는다. 올린 지 24시간이 지난 키로 보내거나 증빙을 붙이면 `UPLOAD_MISMATCH`이고 아무것도 남지 않는다. 저장소가 없으면 건너뛰고, 목록이나 지우기가 실패하면 보고하고 다음 실행에 다시 한다. 두 서버가 겹쳐 돌아도 한 번만 돈다.
- 닿는 곳: `storage/storage.ts`(목록, `head`의 올린 시각)·`storage.test.ts`, `storage/uploads.ts`, 객체 지우기 모듈(새, `apps/api/src/storage/`), `purge/run.ts`(`startPurge`), `serve.ts`.
- 검토: 깊게(저장소의 되돌릴 수 없는 삭제). 마이그레이션: 없음.

### 11. 쓴 사람의 메시지 지우기(DEC-54, 시작 전에 시도) [ ]
- 먼저 main에: 조각 8.
- 할 수 있게 되는 것: 운영진이 자기 메시지와 사진을 언제든 앱에서 지운다.
- 수용 기준: 내 메시지의 메뉴에 '메시지 삭제'가 있고 남의 메시지에는 없다. 확인 창에서 [삭제]하면 그 자리가 '삭제된 메시지'이고, 다른 사람의 화면도 다음 읽기에서 같다. 서버는 정한 것 17대로 남의 것·다른 학생회·없는 번호를 404로, 이미 지운 것을 200으로 답하고, 결과는 조각 8의 명령과 같다(판의 지운 사람은 나, 사유 없음). 공지였던 메시지는 공지에서 빠진다. 미인증 401. 들어오면 처리방침 11조 5항을 지금 문장("언제든 지울 수 있습니다. 그 자리에는 "삭제된 메시지"가 남습니다.")으로 되돌리고, DEC-54 '결과'에 더한 줄에서 쓴 사람 부분을 뺀다.
- 닿는 곳: contracts `chat.ts`, api `chat/routes.ts`와 지우기 모듈(새), `http/boundary.test.ts`, web `chat/`의 메시지 메뉴, `components/ConfirmDialog.tsx`, `lib/messages.ts`, `ui-gallery/`, vada-docs `legal/privacy-policy.md`, `decisions/0054-…md`.
- 검토: 깊게(데이터 무결성, 학생회 격리). 마이그레이션: 없음.

## 닫기

기기 확인은 사람이 하고 `docs/device-checks.md`의 새 절 '개인정보'에 옮긴다. A는 회장(데스크톱 Chrome), B는 운영진(아이폰), 시험 학생회(`TESTDATA`)에서 한다.

1. B가 대화에 사진과 글을 보내고 A가 그 메시지로 지출을 만든다 → 진행 에이전트가 B의 메시지를 `privacy erase-messages`로 지운다 → A와 B의 대화와 지출의 근거가 '삭제된 메시지'이고, 증빙 사진은 남는다.
2. B가 사용자 줄 → 탈퇴 → 확인 → '탈퇴 완료' → A의 대화·업무에서 B가 '떠난 운영진 1'이다. B가 다시 로그인하면 학생회가 없다.
3. A가 탈퇴를 누르면 회장 문구가 보인다.
4. (조각 11이 있으면) A가 자기 메시지를 '메시지 삭제'로 지운다 → B의 화면도 '삭제된 메시지'다.

지표와 회고 세 줄은 이 아래에 적는다.
