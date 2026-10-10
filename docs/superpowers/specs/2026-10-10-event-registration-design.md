# M3a 행사 참가 신청 설계

2026-10-10. M3(참가자 모집·참가비·참석 확인)의 첫 단계다. 지금 VADA의 행사에는 이름만 있다. 학생회는 참가 신청을 구글폼으로 받고, 응답 시트를 손으로 정리한다.

M3a에서는 행사에 일시와 장소를 넣는다. 운영진은 행사마다 공개 신청 링크를 연다. 학생은 로그인 없이 휴대폰으로 신청한다. 운영진은 신청자 명단을 보고 신청을 취소할 수 있다. 신청자 정보는 행사가 끝나고 정해진 날이 지나면 저절로 지워진다. 참가비는 M3b, QR 참석 확인은 M3c에서 다룬다.

## 왜 이렇게

- **지금 하는 방식**
  - 학생회는 신청을 구글폼으로 받는다. 입금 캡처는 카카오 채널로 따로 받는다([이화여대 일반대학원 학생회](https://kukewha.ewha.ac.kr/kukewha/grad/notice.do?mode=view&articleNo=525065)).
  - 입금자명 규칙은 학교마다 다르다. 학번 8자리를 쓰라는 곳([동양미래대](https://www.dongyang.ac.kr/bbs/dmu/677/248444/artclView.do))도 있고, 학번을 넣지 말라는 곳도 있다. 그래서 신청자를 찾는 열쇠(학번)는 앱이 정한다.
- **학생회도 개인정보처리자다**
  - 근거: [개인정보보호법 제2조 5호](https://www.law.go.kr/법령/개인정보보호법/제2조), [서울시 FAQ](https://www.seoul.go.kr/helper/privacy_faq.do)("비영리단체까지도 법 적용대상")
  - 처분 사례: 개인정보위가 2023년 경북대 총동창회에 과태료를 매겼다([보안뉴스](https://www.boannews.com/news/articleView.html?idxno=122588)).
  - 동의를 받을 때 네 가지를 알린다([제15조 제2항](https://www.law.go.kr/법령/개인정보보호법/제15조)). 목적, 항목, 보유·이용 기간, 거부할 권리와 거부할 때의 불이익이다.
  - 필요한 최소한만 받는다([제16조](https://www.law.go.kr/법령/개인정보보호법/제16조)).
  - 보유 기간이 지나면 지체 없이 지운다([제21조](https://www.law.go.kr/법령/개인정보보호법/제21조)). 표준 개인정보 보호지침 제10조의 기준은 5일 안이다.
- **명단은 새기 쉽다**
  - 명지대의 한 학과 학생회는 간식 행사 게시물에 학생회비 미납자 실명을 공개했다가 사과했다([SBS](https://news.sbs.co.kr/news/endPage.do?news_id=N1006734992), 2022).
  - 구글폼의 "결과 요약 공개" 설정 때문에 응답이 노출된 사고도 있었다([디지털투데이](https://ditoday.com/?p=107793)).
  - 그래서 명단은 운영진 화면에만 두고, 공개 화면에는 신청 수만 보인다.
- **초대 코드는 넓게 퍼진다:** 초대 코드만 있으면 누구나 미배정 구성원으로 들어온다. 그래서 신청자 정보는 부서가 있는 구성원만 본다. 회장단이 부서를 배정했다는 것은 확인을 거쳤다는 뜻이다.
- **Luma도 권한을 좁힌다:** 체크인만 하는 스태프는 명단 CSV를 내려받지 못한다([Luma](https://help.luma.com/p/check-in)). 그래서 M3a도 명단 내려받기를 넣지 않는다. 파일로 나간 명단은 앱이 지울 수 없다.

## 범위

- **넣는다:**
  - 행사 일시(시작, 끝)와 장소
  - 행사마다 참가 신청 하나와 그 설정
    - 신청 기간: 시작은 고르지 않아도 되고, 마감은 꼭 넣는다.
    - 정원: 선착순이고, 넣지 않아도 된다.
    - 안내 문구, 휴대폰 번호 받기
    - 신청 받기를 멈추거나 다시 받기
  - 공개 신청 화면: 로그인 없이 휴대폰으로 쓴다. 행사 정보, 안내, 개인정보 고지와 동의를 거쳐 신청한다.
  - 내 신청 화면: 개인 링크로 열어 신청을 확인하고, 마감 전에는 취소한다.
  - 신청자 명단: 운영진만 본다. 검색과 취소를 한다.
  - 자동 파기
    - 취소하면 그 신청자의 정보를 바로 지운다.
    - 행사가 끝나고 30일이 지나면 모든 신청자의 정보를 지운다.
- **넣지 않는다:**
  - 참가비, 학생회비 납부 명단, 입금 확인: M3b
  - QR과 체크인: M3c
  - 질문 만들기, 관리자 승인, 대기 신청. 범위를 정할 때 뺐다.
  - 명단 내려받기(엑셀). 파일로 나가면 파기를 통제할 수 없다.
  - 문자·메일 알림
  - 카카오톡 링크 미리보기에 행사 이름 넣기(서버가 화면을 그려야 한다)
  - 행사 이름 바꾸기
  - 요청 수 제한과 봇 막기: 아래 "위험"에 이유를 적는다.

## 정책

1. **권한(`manageEvents`)**
   - 부서가 있는 구성원은 행사 정보 수정, 참가 신청 설정, 신청자 명단 보기와 취소를 한다.
   - 미배정 구성원은 위 기능을 쓰지 못한다(`FORBIDDEN`). 화면에서는 참가자 탭을 감춘다.
   - 행사 만들기는 지금처럼 구성원 누구나 한다.
   - 권한 규칙은 `permissionsOf` 한 곳에 더한다.
2. **행사 일시·장소**
   - 시작 일시: 참가 신청을 만들려면 꼭 있어야 한다. 참가 신청이 생긴 뒤에는 비울 수 없다. 둘 다 `EVENT_TIME_REQUIRED`다.
   - 끝 일시: 넣지 않아도 되고, 넣으면 시작보다 늦어야 한다.
   - 장소: 100자이고, 넣지 않아도 된다.
   - **행사 끝:** 끝 일시가 있으면 그것이고, 없으면 시작 일시다.
   - 시각은 한국 시각 `YYYY-MM-DDTHH:mm`으로 주고받는다. 이 앱은 한국에서만 쓰므로, 기기의 시간대가 달라도 같은 시각이 되게 한다. DB에는 `timestamptz`로 둔다.
   - 신청 마감보다 행사 끝을 앞당기려 하면 막는다(`DEADLINE_AFTER_EVENT`).
   - 수정은 `version`으로 겹침을 막는다(`VERSION_CONFLICT`).
3. **참가 신청 설정**
   - 행사 하나에 참가 신청 하나다(`REGISTRATION_EXISTS`).
   - 마감은 꼭 넣는다. 행사 끝보다 늦을 수 없다(`DEADLINE_AFTER_EVENT`). 행사 당일 현장 신청도 받을 수 있게 행사 끝까지는 허용한다.
   - 시작은 넣지 않아도 된다. 넣으면 마감보다 앞이어야 한다.
   - 정원은 1명에서 5000명까지이고, 넣지 않아도 된다. 지금 신청 수보다 작게 줄여도 된다. 이미 들어온 신청은 그대로 두고, 그때부터는 정원이 찬 상태가 된다.
   - 안내 문구는 1000자다. 대상, 준비물, 문의처를 여기에 적는다.
   - 휴대폰 번호 받기
     - 처음에는 꺼져 있다. 운영진이 연락할 일이 있을 때만 켠다(최소 수집).
     - 끄면 이미 받은 번호도 바로 지운다. 화면은 끄기 전에 이것을 확인받는다.
   - 신청 받기: 만들 때는 켜져 있다. 멈추면 새 신청만 막는다. 취소는 막지 않는다.
   - 수정은 `version`으로 겹침을 막는다.
4. **신청 상태:** 서버가 계산한다. 위에서부터 먼저 맞는 것이다.
   - `closed`(마감): 지금이 마감 시각 이후다.
   - `paused`(멈춤): 운영진이 신청 받기를 멈췄다.
   - `upcoming`(시작 전): 지금이 시작 시각 전이다.
   - `full`(정원 참): 신청 수가 정원 이상이다.
   - `open`(받는 중)
5. **신청**
   - 받는 것
     - 이름: 30자
     - 학번: 공백과 `-`를 빼고 숫자 6~12자리
     - 휴대폰 번호: 받을 때만 넣는다. 공백과 `-`를 빼고 `01`로 시작하는 10~11자리다.
     - 동의: 꼭 `true`
   - 상태가 `open`이 아니면 막는다(`REGISTRATION_NOT_OPEN`). 정원이 찼으면 `REGISTRATION_FULL`이다.
   - 같은 신청에 같은 학번이 이미 있으면 막는다(`ALREADY_REGISTERED`). 취소하거나 지워진 신청은 세지 않는다.
   - 정원은 신청 설정 행을 잠근 뒤에 세고 넣는다. 그래서 동시에 들어와도 정원을 넘지 않는다.
   - 성공하면 개인 토큰(무작위 128비트)을 한 번만 돌려준다. DB에는 토큰의 SHA-256만 둔다.
6. **내 신청**
   - 토큰으로 찾는다. 행사 정보와 내가 넣은 내용, 신청 시각을 보여 준다.
   - 신청자는 마감 전까지 스스로 취소한다. 멈춤 상태에도 취소할 수 있다. 마감 뒤에는 안내 문구의 문의처로 연락한다(`CANCEL_CLOSED`).
   - 토큰을 모르거나 이미 지워졌으면 `NOT_FOUND`다. 취소한 사람과 보관 기간이 지난 사람을 구분하지 않는다.
7. **운영진 취소:** 마감 뒤에도 할 수 있다. 화면은 "취소하면 이 사람의 정보를 바로 지워요"를 확인받는다.
8. **파기**
   - 취소하면 바로 이름, 학번, 휴대폰 번호, 토큰을 지운다. 행은 남지만 신청 수에는 넣지 않는다.
   - **지울 때:** 행사 끝에서 30일 뒤다.
   - 그때가 되면 취소하지 않은 신청의 같은 칸도 모두 지운다. 그 뒤에는 신청 수만 남는다. 다음 행사의 통계와 M3b 정산이 쓴다.
   - 서버는 시작할 때와 1시간마다 지울 때가 지난 정보를 지운다.
     - 참가 신청 하나를 읽거나 바꾸는 요청도 먼저 그 신청에서 지울 정보를 지운다. 그래서 서버가 늦게 지우더라도 응답에는 나가지 않는다.
     - Render 무료 서버가 잠들어 있으면 깨어날 때 지운다.
   - 행사 날짜를 미루면 지울 때도 함께 미뤄진다. 고지에도 "행사가 끝나고 30일 뒤"로 적는다.
9. **개인정보 고지:** 운영진이 고칠 수 없다. 공개 신청 화면에 다음을 적고, 동의 칸을 꼭 체크해야 신청된다.
   - 받는 곳: 학생회 이름
   - 목적: "{행사 이름} 참가 신청 확인과 행사 운영"
   - 항목: 이름, 학번(, 휴대폰 번호)
   - 보유 기간: "행사가 끝나고 30일 뒤({날짜}) 지워요"
   - 거부권: "동의하지 않을 수 있어요. 다만 동의하지 않으면 신청할 수 없어요."
10. **링크**
    - 공개 신청: `/apply/{코드}`. 코드는 초대 코드와 같은 8자리 형식이다. 행사의 링크는 바뀌지 않는다.
    - 내 신청: `/r#{토큰}`
      - 토큰을 `#` 뒤에 둔다. 그래서 서버 접속 기록에 남지 않는다.
      - 화면은 토큰을 요청 본문에 실어 보낸다(POST). 그래서 API 주소에도 토큰이 나오지 않는다.
    - 신청한 기기에는 코드별 토큰을 저장해 둔다. 같은 기기로 신청 링크를 다시 열면 "이미 신청했어요 · 내 신청 보기"를 보여 준다.
11. **공개 화면**
    - 휴대폰 화면이 기준이다(EXT 390px). 로그인과 카카오톡 밖으로 넘기기를 하지 않는다. 링크는 대부분 카톡 안에서 열리고, 로그인이 없으면 넘길 이유도 없다.
    - 시작 전 상태에서 시작 시각이 되면 화면이 신청 정보를 다시 받아 신청 칸을 연다. 선착순을 기다리는 학생은 새로고침하지 않아도 된다.
    - 공개 화면에 보이는 것은 행사 정보, 안내, 상태, 남은 자리 수뿐이다. 다른 신청자에 대해서는 아무것도 보이지 않는다.

## 와이어프레임과 다른 점

기준 화면은 다음과 같다.

| 화면 | 노드 |
|---|---|
| EVT-04 명단 | `20:7510` |
| EVT-04C 빈 상태 | `20:7347` |
| EVT-05 참여 설문 | `25:420` |
| EVT-02B 정보 편집 | `20:5012` |
| EXT-02A 신청 | `30:7128` |
| EXT-02B 완료 | `30:7230` |
| EXT-02C 예외·종료 | `30:7266` |

- **탭:** "인원 관리 > 행사 참가자"를 "참가자" 탭 하나로 둔다. 운영 조직은 없다. 탭 순서는 대화, 구매, 참가자, 재정이다(와이어프레임에서 인원 관리가 재정 바로 앞이다).
- **행사 정보 편집(EVT-02B):** 일시와 장소만 넣는다. 개요 탭이 없으므로 참가자 탭 맨 위에 둔다.
- **참여 설문(EVT-05):** "질문 설정"을 빼고 모집 설정만 둔다. 신청 방식(선착순/관리자 승인)과 대기 신청도 뺀다.
- **신청 화면(EXT-02A):** 단과대학, 학과, 학년, 참가 동기를 뺀다(최소 수집). 개인정보 고지와 동의를 더한다.
- **신청 완료(EXT-02B):**
  - 와이어프레임의 "참가비 관리자 확인 중"은 M3b가 바꾼다.
  - M3a 화면에는 신청한 내용, 개인 링크 저장 안내, 취소를 둔다.
- **명단(EVT-04):** 입금 상태와 참석 상태 칸은 M3b·M3c에서 더한다. 명단 내보내기는 뺀다.

## 데이터 (마이그레이션 0020)

**events** (칸 추가)

| 칸 | 내용 |
|---|---|
| `starts_at` | 비어 있을 수 있다. 시작 일시 |
| `ends_at` | 비어 있을 수 있다. 끝 일시 |
| `place` | 비어 있을 수 있다. 공백 아님, 100자 |
| `version` | 기본 1 |

- CHECK `ends_at IS NULL OR (starts_at IS NOT NULL AND ends_at > starts_at)`
- CHECK 두 일시 모두 2000~2999년
- CHECK `version >= 1`

**registration_forms** (새 표: 행사의 참가 신청 설정)

| 칸 | 내용 |
|---|---|
| `id` | PK |
| `organization_id` | FK |
| `event_id` | 유일. (학생회, 행사) 복합 FK → events |
| `code` | 유일. 기본값 `vada_invite_code()`. 형식 검사는 초대 코드와 같다 |
| `accepting` | 기본 true |
| `opens_at` | 비어 있을 수 있다 |
| `closes_at` | 꼭 있다 |
| `capacity` | 비어 있을 수 있다. 1~5000 |
| `notice` | 비어 있을 수 있다. 공백 아님, 1000자 |
| `collect_phone` | 기본 false |
| `version` | 기본 1 |
| `created_by` | users FK |
| `created_at`, `updated_at` | |

- CHECK `opens_at IS NULL OR opens_at < closes_at`
- CHECK 일시 범위는 2000~2999년이다.

**registrations** (새 표: 신청 한 건)

| 칸 | 내용 |
|---|---|
| `id` | PK |
| `organization_id` | FK |
| `form_id` | (학생회, 참가 신청) 복합 FK → registration_forms |
| `token_hash` | 유일. 비어 있을 수 있다. SHA-256 16진 64자 |
| `name` | 비어 있을 수 있다. 공백 아님, 30자 |
| `student_id` | 비어 있을 수 있다. `^[0-9]{6,12}$` |
| `phone` | 비어 있을 수 있다. `^01[0-9]{8,9}$` |
| `created_at` | |
| `cancelled_at`, `cancelled_by` | 비어 있을 수 있다. 신청자가 스스로 취소하면 `cancelled_by`는 비어 있다 |
| `purged_at` | 비어 있을 수 있다. 정보를 지운 때 |

- CHECK 지우지 않았으면 토큰·이름·학번이 있고, 지웠으면 네 칸이 모두 비어 있다:
  `(purged_at IS NULL AND token_hash IS NOT NULL AND name IS NOT NULL AND student_id IS NOT NULL)`
  `OR (purged_at IS NOT NULL AND token_hash IS NULL AND name IS NULL AND student_id IS NULL AND phone IS NULL)`
- CHECK 취소했으면 지웠다: `cancelled_at IS NULL OR purged_at IS NOT NULL`
- CHECK `cancelled_by IS NULL OR cancelled_at IS NOT NULL`
- unique 색인 `(form_id, student_id) WHERE purged_at IS NULL`. 같은 신청에 살아 있는 같은 학번은 하나다.
- 색인 `(form_id, created_at)`

**배포 순서**
- 새 코드가 새 칸과 새 표를 읽는다. 그래서 두 DB에 먼저 적용하고 배포한다.
- 기존 칸에 새로 거는 제약은 없다. events의 새 칸은 모두 비어 있거나 기본값이라 CHECK를 어길 수 없다.
- 모든 FK는 `ON DELETE RESTRICT`다.

## API

본문은 contracts의 `z.strictObject`이고, `json(Schema)`를 인증보다 앞에 둔다.

**운영진 경로**
- 앞부분은 `/api/organizations/:organizationId/events/:eventId`다.
- 행사 정보 수정은 행사 모듈(`AppOptions.events`)에 더한다. 나머지는 새 모듈 `AppOptions.registrations`에 둔다.
- 모든 경로가 `manageEvents` 권한을 요구한다.

| 경로 | 본문 → 응답 |
|---|---|
| `PATCH /` | `UpdateEventSchema { version, startsAt, endsAt, place }` → `EventResponse` |
| `GET /registration` | → `RegistrationResponse` |
| `POST /registration` | `CreateRegistrationFormSchema` → `RegistrationResponse` (201) |
| `PATCH /registration` | `UpdateRegistrationFormSchema { version, accepting, ... }` → `RegistrationResponse` |
| `POST /registration/entries/:registrationId/cancel` | `{}` → `RegistrationResponse` |

- `RegistrationResponse`: `{ form: RegistrationFormView | null, registrations: RegistrationEntry[] }`
  - `RegistrationFormView`
    - 설정 칸 전부, 링크 코드, 상태
    - `count`: 취소하지 않은 신청 수. 지운 신청도 센다.
    - `purgeAfter`: 지울 날, 한국 날짜
    - `purged`: 지울 때가 지났는지
  - `RegistrationEntry`: `{ id, name, studentId, phone, createdAt }`
    - 지우지 않은 신청만 신청 순서대로 담는다.
- `EventSummary`에 `startsAt`, `endsAt`, `place`, `version`을 더한다.

**공개 경로**
- 앞부분은 `/api/public/`다. 공통 가드(출처·형식·크기)를 `/api/public/*`에도 건다.
- `boundary.test.ts`는 변경 라우트가 `/api/organizations/`나 `/api/public/` 아래에 있는지 확인한다. 두 곳 모두에 같은 경계 검사를 돌린다.

| 경로 | 본문 → 응답 |
|---|---|
| `GET /api/public/registration-forms/:code` | → `PublicRegistrationForm` |
| `POST /api/public/registration-forms/:code/entries` | `RegisterSchema { name, studentId, phone, agreed }` → `{ token }` (201) |
| `POST /api/public/registrations/lookup` | `{ token }` → `MyRegistration` |
| `POST /api/public/registrations/cancel` | `{ token }` → `MyRegistration` |

- `PublicRegistrationForm`
  - `{ organizationName, event: { name, startsAt, endsAt, place }, notice, collectPhone, state, opensAt, closesAt, remaining, purgeAfter }`
  - `remaining`: 정원이 없으면 null이다.
- `MyRegistration`
  - `{ code, organizationName, event, name, studentId, phone, createdAt, cancelled, cancellable }`
  - 취소 응답은 `cancelled: true`이고 개인 칸은 비운다. 취소 직후 화면이 쓴다.

**오류**

| 코드 | 상태 | 뜻 |
|---|---|---|
| `NOT_FOUND` | 404 | 없는 코드·토큰·행사 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `VERSION_CONFLICT` | 409 | 남이 먼저 바꿈 |
| `EVENT_TIME_REQUIRED` | 409 | 행사 시작 일시 없음 |
| `DEADLINE_AFTER_EVENT` | 409 | 마감이 행사 끝보다 늦음 |
| `REGISTRATION_EXISTS` | 409 | 참가 신청이 이미 있음 |
| `REGISTRATION_NOT_OPEN` | 409 | 받는 중이 아님 |
| `REGISTRATION_FULL` | 409 | 정원 참 |
| `ALREADY_REGISTERED` | 409 | 같은 학번이 이미 신청함 |
| `CANCEL_CLOSED` | 409 | 마감 뒤 스스로 취소 |

**파기 실행기:** `createRegistrationPurger(db).start()`를 `serve.ts`에서 상품 조회 실행기처럼 켠다. 시작할 때 한 번 돌고, 그 뒤 1시간마다 돈다. 타이머는 `unref`한다.

## 화면

**운영진: 행사의 "참가자" 탭**

권한자에게만 보인다. 휴대폰에서는 한 열이다.
1. **행사 정보 카드**
   - 일시와 장소를 보여 준다.
   - "수정"을 누르면 대화상자가 열린다. 시작 일시, 끝 일시(선택), 장소(선택)를 넣는다.
2. **참가 신청 카드**
   - 아직 없으면 "참가 신청 받기"를 보여 준다. 행사 시작 일시가 없으면 버튼을 막고 이유를 적는다.
   - 있으면 다음을 보여 준다.
     - 상태 칩
     - 공개 링크와 복사 버튼
     - 신청 기간, 정원(신청 수/정원), 휴대폰 번호 받기 여부, 안내 문구
     - "행사가 끝나고 30일 뒤({날짜}) 신청자 정보를 지워요"
   - 버튼
     - 설정 바꾸기: 대화상자가 열린다.
     - 신청 받기 멈추기 / 다시 받기
3. **신청자 카드**
   - 신청 수와 검색(이름, 학번)
   - 줄마다 순번, 이름, 학번, 휴대폰 번호, 신청 시각을 보여 준다. 취소 버튼을 누르면 확인 대화상자가 열린다.
   - 지울 때가 지났으면 "보관 기간이 지나 신청자 정보를 지웠어요(신청 N명)"를 보여 준다.

**공개: `/apply/:code`, `/r`**

- 화면 진입은 같은 `index.html`이다. `main.tsx`가 주소를 보고 공개 화면을 따로 불러온다(동적 import).
  - 공개 화면은 로그인 코드를 받지 않는다.
  - 공개 화면에서는 카카오톡 밖으로 넘기지 않는다.
- 서버의 `attachWeb`은 `/apply/:code`와 `/r`에도 `index.html`을 준다.
- **신청 화면:**
  - 학생회 이름, 행사 이름, 일시, 장소, 상태와 남은 자리, 안내 문구를 보여 준다.
  - 입력 칸은 이름, 학번, 휴대폰 번호(받을 때)다.
  - 개인정보 고지를 보여 주고, 동의 체크 칸을 둔다.
  - 신청 버튼은 같은 스키마의 `safeParse`로 켠다.
  - 받는 중이 아니면 입력 칸 대신 상태 안내를 보여 준다(EXT-02C). 시작 전이면 시작 시각을 알려 준다.
- **내 신청 화면:**
  - 신청 완료 표시, 행사 정보, 내가 넣은 내용을 보여 준다.
  - "이 화면 주소를 저장해 두세요. 신청을 확인하고 취소할 때 필요해요"를 적고, 주소 복사 버튼을 둔다.
  - 마감 전이면 취소 버튼이 있고, 누르면 확인을 받는다.
  - 찾을 수 없으면 "신청 정보를 찾을 수 없어요. 취소했거나 보관 기간이 지났을 수 있어요."를 보여 준다.

## 테스트

- **contracts:**
  - 각 스키마의 상한과 상한+1(이모지 포함), 빈 값·공백만, NUL과 홀로 쓰인 서러게이트, 모르는 키
  - 학번·휴대폰 번호 정리(공백과 `-` 빼기)와 형식
  - 한국 시각 형식과 없는 날짜
- **API:**
  - 운영진 경로: AGENTS.md 목록 전부(성공, 필수값 누락, 빈 값, 상한+1, NUL, 모르는 키, 다른 학생회 사용자, 미인증)와 미배정 403
  - 상태 다섯 가지와 그 우선순위
  - 동시 신청: 정원이 하나 남았을 때 두 건이 함께 오면 하나만 된다.
  - 같은 학번, 취소한 뒤 다시 신청
  - 휴대폰 받기를 끄면 받은 번호가 지워진다.
  - 행사 날짜를 바꿀 때 걸리는 제약(`DEADLINE_AFTER_EVENT`, `EVENT_TIME_REQUIRED`)
  - 파기: 실행기, 읽기 전 지우기, 지운 뒤 신청 수
  - 토큰 조회와 취소, 마감 뒤 취소, 없는 토큰
- **boundary.test:** `/api/public/` 경로에도 출처·형식·크기·모르는 키 검사가 먼저 걸린다.
- **화면:**
  - 공개 신청: 상태별 화면, 신청 버튼 켜짐, 신청 뒤 이동, 기기 저장
  - 내 신청: 보기, 취소, 찾을 수 없음
  - 참가자 탭: 만들기, 설정 바꾸기, 멈추기, 검색, 취소, 권한 없을 때 감춤
  - 공개 주소 판별 함수

## 위험

실제 행사에 쓰기 전에 볼 것들이다.

- **Render 무료 서버의 첫 접속(약 40초)**
  - 공개 신청 링크는 학생이 카톡에서 바로 누른다. 첫 화면이 늦으면 신청을 포기할 수 있다.
  - 실제 행사에 쓰기 전에 깨워 두기(cron-job.org)나 유료(월 7달러)를 정한다. "사용자 받기 전" 묶음에 들어 있다.
- **봇이 가짜 학번으로 정원을 채울 수 있다**
  - IP 기준 요청 수 제한은 넣지 않는다.
    - 강의실 와이파이처럼 한 IP로 몰리는 선착순 신청을 막을 수 있다.
    - Render는 `X-Forwarded-For`를 덧붙이기만 해서 IP를 꾸밀 수 있다([Render 요청](https://feedback.render.com/features/p/send-the-correct-xforwardedfor)).
  - 생기면 운영진이 취소하고, Cloudflare Turnstile을 더한다.
- **학생회의 개인정보 처리방침:** 앱은 신청 화면에서 고지를 한다. 처리방침 공개(위탁 등)는 학생회가 한다.
